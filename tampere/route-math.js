export const nominal = { '10k': 10000, half: 21097.5, full: 42195 };
const rad = Math.PI / 180;
export function metres(a,b) {
  const dl=(b[1]-a[1])*rad, dn=(b[0]-a[0])*rad;
  const h=Math.sin(dl/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dn/2)**2;
  return 12742017.6*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function prepareRoute(route) {
  const points=route.geometry.coordinates;
  const cumulative=[0];
  for(let i=1;i<points.length;i++) cumulative.push(cumulative[i-1]+metres(points[i-1],points[i]));
  return {points,cumulative,total:cumulative.at(-1)};
}
export function pointAt(route,position) {
  const s=Math.max(0,Math.min(route.total,position));
  let lo=0,hi=route.points.length-1;
  while(lo+1<hi){const m=(lo+hi)>>1;if(route.cumulative[m]<s)lo=m;else hi=m;}
  const t=(s-route.cumulative[lo])/(route.cumulative[hi]-route.cumulative[lo]||1);
  const a=route.points[lo],b=route.points[hi];
  return {lng:a[0]+(b[0]-a[0])*t,lat:a[1]+(b[1]-a[1])*t};
}
export function bearing(a,b) {
  const dl=(b.lng-a.lng)*rad,la=a.lat*rad,lb=b.lat*rad;
  return (Math.atan2(Math.sin(dl)*Math.cos(lb),Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dl))/rad+360)%360;
}
