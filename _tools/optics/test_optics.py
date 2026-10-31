"""Numerical and model-contract checks; not validation of a real camera lens."""
import math
import json
import unittest
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

from optics import DEFAULTS, calculate, clean, prescription, trace_one, index, pupil_samples, bend


class OpticsChecks(unittest.TestCase):
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
