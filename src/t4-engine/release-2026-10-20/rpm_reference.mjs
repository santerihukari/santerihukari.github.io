export const rpmControl={min:300,max:5000,step:1,default:850};
export const rpmSource='https://vandimensions.com/media/pages/database/volkswagen/transporter-t4-california/34fd3cce14-1626780416/l-g-0003586520-0006912755.pdf';
export const rpmGuides=[
  {id:'idle',label:'Idle ~800-950',min:800,max:950,approximate:true},
  {id:'driving',label:'Driving ~1500-3000',min:1500,max:3000,approximate:true},
  {id:'torque',label:'Max torque 2000-3000',min:2000,max:3000,approximate:false},
  {id:'power',label:'Rated power 3700',min:3700,max:3700,approximate:false},
];

export function parseRpm(value){
  if(typeof value==='string'&&!value.trim())return null;
  const number=Number(value);
  return Number.isInteger(number)&&number>=rpmControl.min&&number<=rpmControl.max?number:null;
}
export function rpmBand(rpm){
  if(rpm<800)return 'Below idle guide';
  if(rpm<=950)return 'Idle (approx.)';
  if(rpm<1500)return 'Low speed';
  if(rpm<=3000)return 'Driving (approx.)';
  if(rpm===3700)return 'Rated power reference';
  return 'High speed';
}
