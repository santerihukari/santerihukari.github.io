"""Numerical and model-contract checks; not validation of a real camera lens."""
import math
import json
import unittest
from unittest.mock import patch
from pathlib import Path
import sys
import zipfile

import numpy as np

ROOT=Path(__file__).resolve().parents[2]
NATIVE=ROOT/"output/optics-site/native-tests"
NATIVE.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(ROOT/"assets/optics/physics.zip") as archive:
    for item in archive.infolist():
        target=(NATIVE/item.filename).resolve()
        if not target.is_relative_to(NATIVE.resolve()):raise ValueError("Unsafe numerical archive path")
    archive.extractall(NATIVE)
sys.path.insert(0,str(NATIVE))

from optics import DEFAULTS, calculate, clean, prescription, trace_one, index, pupil_samples, pupil_outline, mask_vertices, inside_polygon, bend


class OpticsChecks(unittest.TestCase):
    def test_auto_iso_meters_fixed_aperture_and_shutter(self):
        base=calculate({"workMode":"exposure","autoIso":True,"shutter":1/1000})
        stopped=calculate({**base["settings"],"fnumber":5.6})
        self.assertEqual(base["settings"]["iso"],800);self.assertEqual(stopped["settings"]["iso"],3200)
        self.assertEqual(stopped["settings"]["shutter"],1/1000)
        self.assertTrue(base["auto_iso"]["enabled"])
        self.assertLess(abs(base["exposure_ev"]),.2);self.assertLess(abs(stopped["exposure_ev"]),.2)
        masked=calculate({**base["settings"],"apertureShape":"star"})
        self.assertGreater(masked["settings"]["iso"],base["settings"]["iso"])

    def test_auto_iso_reports_limits_and_does_not_override_manual_iso(self):
        dark=calculate({"workMode":"exposure","autoIso":True,"shutter":1/8000,"fnumber":22})
        bright=calculate({"workMode":"exposure","autoIso":True,"shutter":900})
        self.assertEqual(dark["settings"]["iso"],51200);self.assertEqual(dark["auto_iso"]["limit"],"maximum")
        self.assertEqual(bright["settings"]["iso"],100);self.assertEqual(bright["auto_iso"]["limit"],"minimum")
        self.assertEqual(dark["auto_iso"]["range"],[100,51200])
        for raw in [{"workMode":"exposure","autoIso":False},{"workMode":"geometry","autoIso":True}]:
            d=calculate({**raw,"iso":200,"shutter":1/8000})
            self.assertEqual(d["settings"]["iso"],200);self.assertFalse(d["auto_iso"]["enabled"])

    def test_r5_normal_maximum_iso_is_available_without_expansion(self):
        for iso in [50,6400,8000,12800,25600,51200]:
            d=calculate({"workMode":"exposure","iso":iso})
            self.assertEqual(d["settings"]["iso"],iso)
            self.assertTrue(math.isfinite(d["relative_exposure"]))
        for iso in [51201,102400]:
            with self.assertRaises(ValueError):clean({"iso":iso})
        d=calculate({"workMode":"exposure","autoIso":True,"shutter":1/8000,"fnumber":2.8})
        self.assertEqual(d["settings"]["iso"],6400)
        self.assertIsNone(d["auto_iso"]["limit"])

    def test_shutter_supports_fast_standard_speeds_and_long_custom_durations(self):
        for shutter in [1/8000,.3,30,60,900,86400,1e10,1e308,1e-300]:
            d=calculate({"shutter":shutter})
            self.assertEqual(d["settings"]["shutter"],shutter)
            self.assertTrue(math.isfinite(d["relative_exposure"]))
            self.assertTrue(math.isfinite(d["exposure_ev"]))
            json.dumps(d,allow_nan=False)
        for shutter in [0,-1,float('inf'),float('nan'),None,"bulb"]:
            with self.assertRaises(ValueError):clean({"shutter":shutter})

    def test_long_exposure_is_log_linear_and_warns_about_motion_sampling(self):
        a,b=calculate({"shutter":30}),calculate({"shutter":60})
        self.assertAlmostEqual(b["exposure_ev"]-a["exposure_ev"],1,places=10)
        self.assertAlmostEqual(b["relative_exposure"]/a["relative_exposure"],2,places=10)
        moving=calculate({"shutter":60,"motion":1})
        self.assertTrue(any("time samples" in warning for warning in moving["warnings"]))

    def test_noise_toggle_does_not_modify_optical_geometry_or_exposure(self):
        a=calculate({"sensorNoise":True});b=calculate({"sensorNoise":False})
        for key in ["matrix","sensor_z","projection","targets","point_spread","relative_exposure"]:
            self.assertEqual(a[key],b[key])
        self.assertTrue(a["settings"]["sensorNoise"]);self.assertFalse(b["settings"]["sensorNoise"])

    def test_special_masks_share_preview_spot_and_aperture_geometry(self):
        hashes=set()
        for shape in ["star","heart","cross","slit"]:
            vertices=mask_vertices(shape)
            self.assertTrue(all(math.hypot(x,y)<=1+1e-12 for x,y in vertices))
            d=calculate({"apertureShape":shape,"focal":85,"focus":.52,"diffraction":False})
            for count in [48,96]:
                samples=d["pupil"][f"samples_{count}"]
                self.assertEqual(len(samples),count)
                self.assertTrue(all(inside_polygon(x,y,vertices) for x,y in samples))
            self.assertEqual(len(d["pupil"]["visibility_samples"]),13)
            self.assertGreater(d["pupil"]["area_fraction"],0)
            self.assertLess(d["pupil"]["area_fraction"],1)
            cdf=np.asarray(d["point_spread"]["cdf"]).reshape(130,130)
            self.assertAlmostEqual(float(cdf[-1,-1]),1,places=12)
            self.assertTrue(np.isfinite(cdf).all())
            hashes.add(cdf.tobytes())
        self.assertEqual(len(hashes),4)

    def test_exposure_obeys_stop_ratios_and_mask_area(self):
        base=calculate({"workMode":"exposure","exposureLock":False})
        for raw,ratio in [({"shutter":.016},2),({"iso":200},2),({"fnumber":5.6},.25)]:
            other=calculate({**base["settings"],**raw})
            self.assertAlmostEqual(other["relative_exposure"]/base["relative_exposure"],ratio,places=10)
        for shape in ["star","heart","cross","slit"]:
            masked=calculate({**base["settings"],"apertureShape":shape})
            self.assertAlmostEqual(masked["relative_exposure"]/base["relative_exposure"],masked["pupil"]["area_fraction"],places=10)
            self.assertEqual(masked["sensor_z"],base["sensor_z"])

    def test_modes_preserve_optics_and_legacy_manual_links(self):
        self.assertEqual(clean({"exposureLock":False})["workMode"],"exposure")
        a=calculate({"workMode":"geometry"});b=calculate({"workMode":"exposure"})
        for key in ["matrix","sensor_z","projection","targets","point_spread"]:self.assertEqual(a[key],b[key])
        for raw in [{"apertureShape":"unknown"},{"workMode":"other"}]:
            with self.assertRaises(ValueError):clean(raw)

    def test_conjugates_and_aperture_are_independent(self):
        for model in ["ideal","singlet","doublet"]:
            for focus in [.3,.5,3,100,"infinity"]:
                d=calculate({"model":model,"focus":focus})
                stopped=calculate({**d["settings"],"fnumber":16})
                self.assertEqual(stopped["sensor_z"],d["sensor_z"])
                self.assertEqual(stopped["matrix"],d["matrix"])
                self.assertEqual(stopped["effective_focus_m"],d["effective_focus_m"])
                u=None if focus=="infinity" else focus*1000+d["principal_planes"]["front"]
                v=d["sensor_z"]-d["principal_planes"]["back"]
                self.assertAlmostEqual((0 if u is None else 1/u)+1/v,1/d["efl"],places=11)
                if model=="ideal":
                    expected=50 if u is None else 50*u/(u-50)
                    self.assertAlmostEqual(d["sensor_z"],expected,places=10)

    def test_sensor_size_changes_crop_not_focus_or_lens(self):
        for model in ["ideal", "singlet", "doublet"]:
            for focus in [3, "infinity"]:
                for criterion in ["traditional", "custom"]:
                    base=calculate({"model":model,"focus":focus,"cocMode":criterion})
                    small=calculate({**base["settings"],"sensorW":17.3,"sensorH":13})
                    for key in ["matrix","surfaces","aperture","efl","sensor_z","effective_focus_m","focus_state","projection","targets","rays"]:
                        self.assertEqual(small[key],base[key],key)
                    if criterion=="custom":self.assertEqual(small["dof"],base["dof"])
                    else:self.assertNotEqual(small["dof"]["criterion_um"],base["dof"]["criterion_um"])
                    self.assertNotEqual(small["sensor"]["megapixels"],base["sensor"]["megapixels"])

    def test_display_rays_cover_the_aperture_outline(self):
        for blades in [0,3,4,5,6,7,8,9]:
            outline=pupil_outline(blades)
            self.assertGreaterEqual(len(outline),32)
            if not blades:
                for x,y in outline:self.assertAlmostEqual(math.hypot(x,y),1,places=12)
            else:
                vertices=[(math.cos(2*math.pi*i/blades),math.sin(2*math.pi*i/blades)) for i in range(blades)]
                for vertex in vertices:self.assertTrue(any(math.dist(vertex,p)<1e-12 for p in outline))
                for x,y in outline:
                    edges=[abs((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])) for a,b in zip(vertices,vertices[1:]+vertices[:1])]
                    self.assertLess(min(edges),1e-12)
            d=calculate({"blades":blades})
            for target in range(3):
                rays=[r for r in d["rays"] if r["target"]==target and r.get("boundary")]
                self.assertEqual(len(rays),len(outline))
                for ray,(x,y) in zip(rays,outline):
                    self.assertTrue(ray["passed"])
                    self.assertAlmostEqual(ray["points"][1][0],x*d["aperture"]/2)
                    self.assertAlmostEqual(ray["points"][1][1],y*d["aperture"]/2)

    def test_marginal_display_rays_do_not_reweight_the_spot_analysis(self):
        for model in ["ideal","singlet","doublet"]:
            d=calculate({"model":model,"rgb":True})
            with patch("optics.pupil_outline",return_value=[]):reference=calculate({"model":model,"rgb":True})
            for key in ["spots","spot_center","spot_rms_um","point_spread","diffraction"]:
                self.assertEqual(d[key],reference[key],key)

    def test_thin_lens_conjugate(self):
        d=calculate({})
        expected=1/(1/50-1/3000)
        self.assertAlmostEqual(d["sensor_z"],expected,places=10)
        self.assertAlmostEqual(d["projection"]["K"],expected,places=10)
        self.assertAlmostEqual(d["projection"]["focus_inverse_m"],1/3,places=10)

    def test_in_focus_ideal_bundle_converges(self):
        p=clean({});surfaces,m,_,_=prescription(p);d=calculate(p)
        hits=[]
        for x,y in pupil_samples(33):
            points,passed=trace_one(p,surfaces,m,d["sensor_z"],(x*8,y*8),(0,165,3000))
            self.assertTrue(passed);hits.append(points[-1][:2])
        self.assertLess(np.max(np.ptp(hits,axis=0)),1e-10)

    def test_infinity_is_exact_back_focal_plane(self):
        for model in ["ideal", "singlet", "doublet"]:
            d=calculate({"model":model,"focus":"infinity"})
            self.assertAlmostEqual(d["sensor_z"],d["back_focal_z"],places=10)
            self.assertEqual(d["focus_state"],"infinity")
            self.assertEqual(d["projection"]["focus_inverse_m"],0)
            self.assertIsNone(d["effective_focus_m"])
            self.assertIsNone(d["dof"]["far_m"])
            self.assertGreater(d["dof"]["near_m"],0)
            self.assertFalse(any("no finite" in text for text in d["warnings"]))
            json.dumps(d,allow_nan=False)
            for t in d["targets"]:
                expected=d["aperture"]*d["projection"]["K"]/t["distance"]*1000
                self.assertAlmostEqual(t["blur_um"],expected,places=8)

    def test_long_finite_focus_converges_to_infinity(self):
        for model in ["ideal","singlet","doublet"]:
            a,b,c=[calculate({"model":model,"focus":focus}) for focus in [100,1000000,"infinity"]]
            self.assertEqual(a["focus_state"],"finite")
            self.assertAlmostEqual(a["effective_focus_m"],100,places=7)
            self.assertLess(abs(b["sensor_z"]-c["sensor_z"]),abs(a["sensor_z"]-c["sensor_z"]))
            self.assertAlmostEqual(b["sensor_z"],c["sensor_z"],places=5)

    def test_sensor_offset_can_change_infinity_conjugate(self):
        for offset,state in [(-1,"virtual"),(0,"infinity"),(1,"finite")]:
            d=calculate({"focus":"infinity","sensorOffset":offset})
            self.assertEqual(d["focus_state"],state)
            if state=="virtual":self.assertLess(d["projection"]["focus_inverse_m"],0)
            if state=="finite":self.assertGreater(d["effective_focus_m"],0)

    def test_geometric_blur_matches_extreme_rays(self):
        p=clean({"focus":3,"subject":1.8});surfaces,m,_,_=prescription(p);d=calculate(p)
        hits=[trace_one(p,surfaces,m,d["sensor_z"],(x*d["aperture"]/2,0),(0,0,d["targets"][1]["distance"]))[0][-1][0] for x in [-1,1]]
        self.assertAlmostEqual(abs(hits[1]-hits[0])*1000,d["targets"][1]["blur_um"],places=8)

    def test_target_distances_are_independent(self):
        base=calculate({})
        for i,(key,value) in enumerate([("targetA",4.5),("subject",5),("targetC",1)]):
            d=calculate({key:value})
            self.assertEqual(d["targets"][i]["radial_distance"],value*1000)
            self.assertNotEqual(d["targets"][i]["blur_um"],base["targets"][i]["blur_um"])
            self.assertEqual(d["sensor_z"],base["sensor_z"])
            self.assertEqual(d["settings"]["focus"],base["settings"]["focus"])
            for j in range(3):
                if j!=i:self.assertEqual(d["targets"][j],base["targets"][j])
            for axis in ["sensor_x","sensor_y"]:
                self.assertAlmostEqual(d["targets"][i][axis],base["targets"][i][axis],places=10)

    def test_target_order_is_not_constrained(self):
        for model in ["ideal","singlet","doublet"]:
            d=calculate({"model":model,"targetA":100,"subject":.3,"targetC":.4})
            self.assertEqual([t["radial_distance"] for t in d["targets"]],[100000,300,400])
            self.assertEqual([t["name"] for t in d["targets"]],["Target A","Target B","Point source C"])
            self.assertLessEqual(d["blur_curve"]["distance_m"][0],.3)
            self.assertGreaterEqual(d["blur_curve"]["distance_m"][-1],100)
            self.assertTrue(np.isfinite(d["diffraction"]["micro"]).all())

    def test_target_distances_round_trip_and_validate(self):
        p=clean({"targetA":2.4,"subject":6,"targetC":1.2})
        self.assertEqual(calculate(json.loads(json.dumps(p)))["settings"],p)
        for key in ["targetA","subject","targetC"]:
            for value in [0,201,float('nan'),float('inf')]:
                with self.assertRaises(ValueError):calculate({key:value})

    def test_radial_range_is_euclidean_distance_from_pupil(self):
        d=calculate({"targetA":4,"targetAX":-30,"targetAY":20,
                     "subject":7,"targetBX":10,"targetBY":-15,
                     "targetC":2,"targetCX":25,"targetCY":12})
        for t in d["targets"]:
            self.assertAlmostEqual(math.sqrt(t["x"]**2+t["y"]**2+t["distance"]**2),t["radial_distance"],places=9)
            self.assertLess(t["distance"],t["radial_distance"])

    def test_radial_motion_scales_xyz_without_sensor_drift(self):
        for key,i in [("targetA",0),("subject",1),("targetC",2)]:
            base=calculate({key:2})
            for radius in [.2,20,200]:
                d=calculate({key:radius});a,b=base["targets"][i],d["targets"][i]
                for axis in ["x","y","distance"]:self.assertAlmostEqual(b[axis],a[axis]*radius/2,places=8)
                for axis in ["sensor_x","sensor_y"]:self.assertAlmostEqual(b[axis],a[axis],places=10)

    def test_xy_angles_are_independent_of_range_and_other_targets(self):
        base=calculate({})
        for i,letter in enumerate("ABC"):
            d=calculate({f"target{letter}X":12,f"target{letter}Y":-8})
            self.assertEqual(d["targets"][i]["radial_distance"],base["targets"][i]["radial_distance"])
            self.assertNotEqual(d["targets"][i]["sensor_x"],base["targets"][i]["sensor_x"])
            self.assertNotEqual(d["targets"][i]["sensor_y"],base["targets"][i]["sensor_y"])
            for j in range(3):
                if i!=j:self.assertEqual(d["targets"][j],base["targets"][j])
        for value in [-81,81,float('nan')]:
            with self.assertRaises(ValueError):calculate({"targetAX":value})

    def test_focus_uses_axial_depth_not_radial_range(self):
        p={"subject":3,"targetBX":30,"targetBY":20}
        radial=calculate({**p,"focus":3})
        self.assertGreater(radial["targets"][1]["blur_um"],1)
        axial=calculate({**p,"focus":radial["targets"][1]["distance"]/1000})
        self.assertLess(axial["targets"][1]["blur_um"],1e-8)

    def test_point_kernel_is_a_normalized_cumulative_distribution(self):
        for blades in [0,3,4,5,8,9]:
            d=calculate({"blades":blades});point=d["point_spread"]
            cdf=np.asarray(point["cdf"]).reshape(point["size"],point["size"])
            self.assertTrue(np.isfinite(cdf).all())
            self.assertAlmostEqual(cdf[-1,-1],1,places=10)
            self.assertTrue((cdf[0,:]==0).all());self.assertTrue((cdf[:,0]==0).all())
            self.assertGreaterEqual(np.diff(cdf,axis=0).min(),-1e-12)
            self.assertGreaterEqual(np.diff(cdf,axis=1).min(),-1e-12)
            self.assertGreater(point["extent_mm"],d["targets"][2]["blur_um"]/2000)

    def test_point_spread_shrinks_when_focused_on_point_c(self):
        a=calculate({});b=calculate({"focus":a["targets"][2]["distance"]/1000})
        self.assertEqual(b["targets"][2]["kind"],"point")
        self.assertLess(b["targets"][2]["blur_um"],1e-8)
        self.assertLess(b["point_spread"]["extent_mm"],a["point_spread"]["extent_mm"])
        self.assertGreater(np.asarray(a["diffraction"]["micro"]).sum(),np.asarray(b["diffraction"]["micro"]).sum()*10)

    def test_point_diffraction_and_polygon_options_change_the_kernel(self):
        focus=calculate({})["targets"][2]["distance"]/1000
        a,b=calculate({"focus":focus}),calculate({"focus":focus,"diffraction":False})
        self.assertGreater(np.asarray(a["diffraction"]["micro"]).sum(),np.asarray(b["diffraction"]["micro"]).sum())
        c,d=calculate({}),calculate({"blades":5})
        self.assertGreater(np.max(np.abs(np.asarray(c["point_spread"]["cdf"])-np.asarray(d["point_spread"]["cdf"]))),.01)

    def test_light_brightness_does_not_change_optics(self):
        a,b=calculate({}),calculate({"lightBrightness":100})
        self.assertEqual(b["settings"]["lightBrightness"],100)
        self.assertEqual(a["targets"],b["targets"])
        self.assertEqual(a["point_spread"],b["point_spread"])
        self.assertEqual(a["sensor_z"],b["sensor_z"])
        for value in [0,1001,float('inf')]:
            with self.assertRaises(ValueError):calculate({"lightBrightness":value})

    def test_stopping_down_trades_defocus_for_diffraction(self):
        a,b=calculate({"fnumber":2.8}),calculate({"fnumber":8})
        self.assertLess(b["targets"][0]["blur_um"],a["targets"][0]["blur_um"])
        self.assertLess(b["dof"]["near_m"],a["dof"]["near_m"])
        self.assertGreater(b["dof"]["far_m"],a["dof"]["far_m"])
        self.assertAlmostEqual(b["diffraction"]["airy_um"]/a["diffraction"]["airy_um"],8/2.8,places=8)

    def test_dof_limits_are_threshold_crossings(self):
        d=calculate({});A,K=d["projection"]["A"],d["projection"]["K"]
        for limit in [d["dof"]["near_m"],d["dof"]["far_m"]]:
            diameter=d["aperture"]*abs(A+K/(limit*1000))*1000
            self.assertAlmostEqual(diameter,d["dof"]["criterion_um"],places=8)

    def test_pixel_pitch_changes_sampling_not_geometric_optics(self):
        a,b=calculate({"pitch":6}),calculate({"pitch":12})
        self.assertAlmostEqual(a["sensor"]["megapixels"],4*b["sensor"]["megapixels"])
        self.assertEqual(a["dof"],b["dof"])
        self.assertEqual(a["diffraction"]["airy_um"],b["diffraction"]["airy_um"])
        self.assertAlmostEqual(a["diffraction"]["airy_pixels"],2*b["diffraction"]["airy_pixels"])

    def test_two_pixel_dof_explicitly_depends_on_pitch(self):
        a,b=calculate({"cocMode":"pixels","pitch":6}),calculate({"cocMode":"pixels","pitch":12})
        self.assertLess(b["dof"]["near_m"],a["dof"]["near_m"])
        self.assertGreater(b["dof"]["far_m"],a["dof"]["far_m"])

    def test_sensor_size_is_crop_when_blur_criterion_fixed(self):
        a,b=calculate({"cocMode":"custom"}),calculate({"sensorW":23.5,"sensorH":15.7,"cocMode":"custom"})
        self.assertEqual(a["dof"],b["dof"])
        self.assertEqual(a["sensor_z"],b["sensor_z"])
        self.assertGreater(a["settings"]["sensorW"]/a["projection"]["K"],b["settings"]["sensorW"]/b["projection"]["K"])

    def test_principal_point_shift_does_not_change_lens(self):
        a,b=calculate({}),calculate({"shiftX":2,"shiftY":-1})
        self.assertEqual(a["efl"],b["efl"]);self.assertEqual(a["dof"],b["dof"])
        self.assertAlmostEqual(b["sensor"]["cx"],a["sensor"]["cx"]-2000/6)
        self.assertAlmostEqual(b["sensor"]["cy"],a["sensor"]["cy"]-1000/6)

    def test_glass_power_agrees_with_independent_lensmaker(self):
        p=clean({"model":"singlet"});s,m,_,_=prescription(p);n=index("N-BK7")
        r1,r2,t=s[0]["radius"],s[1]["radius"],s[1]["z"]
        power=(n-1)*(1/r1-1/r2+(n-1)*t/(n*r1*r2))
        self.assertAlmostEqual(-m.C,power,places=12);self.assertAlmostEqual(1/power,50,places=9)

    def test_library_refraction_obeys_snell(self):
        direction=np.array([math.sin(.3),0,math.cos(.3)])
        out=bend(direction,np.array([0.,0.,1.]),1,1.5)
        self.assertAlmostEqual(out[0]*1.5,direction[0],places=12)
        self.assertAlmostEqual(np.linalg.norm(out),1,places=12)

    def test_bk7_dispersion_and_doublet(self):
        single,double=calculate({"model":"singlet"}),calculate({"model":"doublet"})
        self.assertLess(single["chromatic"][0]["efl"],single["chromatic"][-1]["efl"])
        spans=[abs(d["chromatic"][0]["efl"]-d["chromatic"][-1]["efl"]) for d in [single,double]]
        self.assertLess(spans[1],spans[0]);self.assertAlmostEqual(double["efl"],50,places=8)

    def test_image_side_invariants_and_virtual_conjugate(self):
        d=calculate({"focus":30,"sensorOffset":-3})
        self.assertIsNone(d["effective_focus_m"])
        self.assertLess(d["projection"]["focus_inverse_m"],0)

    def test_reject_invalid_settings(self):
        for settings in [{"focal":0},{"fnumber":float('nan')},{"model":"unknown"},{"pitch":0},
                         {"focus":float('inf')},{"focus":float('nan')},{"focus":"unlimited"},{"focus":1000001}]:
            with self.assertRaises(ValueError):calculate(settings)

    def test_physical_boundary_cases_stay_finite(self):
        for model in ["ideal","singlet","doublet"]:
            for config in [{"focal":18,"focus":.3,"fnumber":1.4},{"focal":135,"focus":30,"fnumber":22},
                           {"thickness":.12,"bending":.7},{"thickness":.4,"bending":-.7}]:
                d=calculate({"model":model,**config})
                self.assertTrue(np.isfinite(d["sensor_z"]));self.assertGreater(d["sensor_z"],0)
                self.assertEqual(np.asarray(d["diffraction"]["micro"]).shape,(41,41))
                self.assertTrue(np.isfinite(d["diffraction"]["micro"]).all())
                self.assertLessEqual(d["aperture"],d["clear_diameter"]+1e-8)


if __name__=="__main__":unittest.main()
