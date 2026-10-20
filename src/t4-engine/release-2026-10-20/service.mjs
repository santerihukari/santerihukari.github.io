// Service identity and tightening specifications are separate from estimated CAD.
export function procedurePublishable(p={}){
  const s=p.source||{},a=p.applicability||{};
  return Boolean(p.status==='verified'&&p.joint_id&&p.reviewed_on&&
    ['manufacturer_joint_instruction','workshop_manual'].includes(s.kind)&&
    typeof s.url==='string'&&s.url.startsWith('https://')&&s.document&&s.section&&
    a.engine_or_gearbox_code&&a.fastener&&a.configuration&&a.matched_to_fitted_vehicle===true&&p.conditions&&p.sequence&&
    typeof p.replace_fastener==='boolean'&&Array.isArray(p.stages)&&p.stages.length&&
    p.stages.every(stage=>typeof stage.value==='number'&&Number.isFinite(stage.value)&&stage.value>0&&['Nm','deg'].includes(stage.unit)));
}

export function retailerProducts(card,products={},partId=card?.part_id){
  return (card?.retailer_product_ids||[]).map(id=>products[id]).filter(Boolean).map(p=>({...p,
    matches:p.matches.filter(m=>m.part_ids.includes(partId))}));
}
export function hasRetailerReplacement(card,products={}){
  return retailerProducts(card,products).some(p=>p.screening_status==='candidate'&&p.matches.some(m=>m.relation!=='related_item'));
}
export function retailerLabel(card,products={}){
  const p=retailerProducts(card,products).find(p=>p.screening_status==='candidate'&&p.matches.some(m=>m.relation!=='related_item'));
  return p?`Motonet candidate: ${p.sku}`:'No Motonet replacement identified';
}
export function partSearchText(part,card,products={}){
  return [part.name,part.id,...(card?.examples||[]).flatMap(e=>[e.manufacturer,e.part_number,...e.oem_cross_references]),
    ...retailerProducts(card,products).flatMap(p=>[p.sku,p.title,p.brand||'',...p.cross_reference_examples])].join(' ').toLowerCase();
}

export function referenceLabel(card){
  const example=card?.examples?.[0];
  return example?`Assembly example: ${example.part_number}`:'Fitted part: unidentified';
}

export function safeWebUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}
}

const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
function paragraph(parent,text,className){parent.append(node('p',text,className));}
function fields(parent,rows){const dl=node('dl');for(const [key,value] of rows){dl.append(node('dt',key),node('dd',value??'Not verified'));}parent.append(dl);}
function sourceLink(parent,source){
  if(!source)return;
  const url=safeWebUrl(source.url);if(!url)return;
  const a=node('a',source.title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);
  paragraph(parent,`Checked ${source.checked_on} | ${source.availability.replaceAll('_',' ')}`,'source-date');
}
function checklist(parent,items){const ul=node('ul');for(const text of items)ul.append(node('li',text));parent.append(ul);}

export class ServicePanel{
  constructor(panel){this.panel=panel;this.tab='part';this.catalogue=null;this.selected=null;this.error=null;}
  load(catalogue,error=null){this.catalogue=catalogue;this.error=error;this.render();}
  select(id){this.selected=id;this.render();}
  setTab(tab){
    if(!['part','fasteners','capture','motonet'].includes(tab))return;
    this.tab=tab;
    for(const button of document.querySelectorAll('[data-service-tab]')){
      const active=button.dataset.serviceTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    }
    this.panel.setAttribute('aria-labelledby',`service-tab-${tab}`);this.render();
  }
  render(){
    const root=this.panel;root.replaceChildren();
    if(!this.catalogue){paragraph(root,this.error||'Loading service references...','service-warning');return;}
    const c=this.catalogue,card=c.parts[this.selected];
    if(this.tab==='motonet'){this.motonet(card);return;}
    if(this.tab==='capture'){this.capture(card);return;}
    if(!card){
      paragraph(root,`${c.summary.part_count} component records | ${c.summary.parts_with_examples} linked to candidate assembly numbers`);
      paragraph(root,`${c.summary.identified_fitted_parts} fitted identities confirmed | ${c.summary.verified_tightening_procedures} verified tightening procedures`,'service-warning');
      sourceLink(root,c.sources.vw_catalogue);return;
    }
    if(this.tab==='fasteners'){this.fasteners(card);return;}
    paragraph(root,'Fitted identity: unidentified','service-warning');
    paragraph(root,card.note);
    const offers=retailerProducts(card,c.retailer_research?.products).filter(p=>p.screening_status==='candidate');
    if(offers.length)paragraph(root,`Motonet: ${offers.length} candidate listings (including any related hardware).`);
    if(!card.examples.length)paragraph(root,'No example part number identified for this component.');
    for(const example of card.examples){
      const section=node('section');section.dataset.example=example.id;
      section.append(node('h4',`${example.manufacturer} ${example.part_number}`));
      paragraph(section,'Candidate complete assembly, not confirmed fitment','service-warning');
      fields(section,[['Reference scope','Parent assembly, not this individual submesh'],['Cross-reference examples',example.oem_cross_references.join(', ')]]);
      paragraph(section,example.fitment_note);sourceLink(section,c.sources[example.source_id]);root.append(section);
    }
    for(const id of card.research_source_ids)sourceLink(root,c.sources[id]);
    paragraph(root,'Price, stock, delivery and ordering compatibility not verified.','source-date');
  }
  fasteners(card){
    const root=this.panel,c=this.catalogue;
    if(!card.joint_ids.length){paragraph(root,'Attachment joint not mapped for this component. Hardware, tools and tightening procedure remain unidentified.','service-warning');sourceLink(root,c.sources.vw_workshop);return;}
    for(const id of card.joint_ids){
      const j=c.joints[id],s=node('section');s.dataset.joint=id;s.append(node('h4',j.name));
      const f=j.fastener,t=j.tools,p=j.tightening,verified=procedurePublishable(p)&&p.joint_id===j.id;
      paragraph(s,verified?'Source-reviewed procedure':'Unverified joint: no torque recommendation','service-warning');
      fields(s,[['Fastener type',f.type],['Thread / pitch',f.thread_diameter_mm!==null&&f.pitch_mm!==null?`M${f.thread_diameter_mm} x ${f.pitch_mm}`:null],
        ['Under-head length',f.under_head_length_mm!==null?`${f.under_head_length_mm} mm`:null],['Grade / head',f.grade&&f.head_style?`${f.grade}; ${f.head_style}`:null],
        ['Installed quantity',j.installed_quantity],['Represented in CAD',`${j.modelled_fastener_count} (not an installed count)`],
        ['Required socket / bit',t.socket_or_bit&&t.size?`${t.socket_or_bit} ${t.size}`:null],['Special tools',t.special_tools],
        ['Tightening',verified?p.stages.map(stage=>`${stage.value} ${stage.unit}`).join(' + '):'Not verified; no generic torque substituted'],
        ['Replacement / lubrication',verified?`${p.replace_fastener?'New fastener required':'See source reuse conditions'}; ${p.conditions}`:null]]);
      if(verified){fields(s,[['Sequence',p.sequence],['Application',Object.values(p.applicability).join('; ')]]);sourceLink(s,{...p.source,title:`${p.source.document}, ${p.source.section}`,checked_on:p.reviewed_on,availability:'joint_reviewed'});}
      paragraph(s,j.note);
      if(id==='head_to_block')paragraph(s,'Motonet candidate sets list 10 head bolts; CAD represents only 8. This model is not a repair BOM.','service-warning');
      const details=node('details');details.append(node('summary','Research sources'));
      for(const source of j.research_source_ids)sourceLink(details,c.sources[source]);s.append(details);root.append(s);
    }
  }
  motonet(card){
    const root=this.panel,research=this.catalogue.retailer_research;
    if(!research){paragraph(root,'Motonet evidence not available for this export.','service-warning');return;}
    const s=research.summary;
    paragraph(root,`${s.categories_inspected} categories | ${s.distinct_listings_reviewed} listings inspected | ${s.replacement_families_mapped} replacement families mapped`);
    paragraph(root,'Catalogue candidates only. ZERO fitted matches confirmed. Supplier SKU is not an OEM number.','service-warning');
    if(!card){
      fields(root,[['Meshes with replacement/assembly candidates',s.parts_with_replacement_candidates],['Candidate listings mapped',s.candidate_listings_mapped_to_this_model],['Screened out',s.screened_out_listings]]);
      sourceLink(root,{title:'Motonet ABL T4 catalogue',url:research.vehicle_catalogue_url,checked_on:research.checked_on,availability:'live_catalogue_reviewed'});
      for(const gap of research.coverage_gaps.filter(g=>g.part_ids.length)){root.append(node('h4',gap.family));paragraph(root,gap.note);}
      return;
    }
    const offers=retailerProducts(card,research.products);
    const direct=offers.filter(p=>p.screening_status==='candidate'&&p.matches.some(m=>m.relation!=='related_item'));
    const related=offers.filter(p=>p.screening_status==='candidate'&&p.matches.every(m=>m.relation==='related_item'));
    const excluded=offers.filter(p=>p.screening_status==='screened_out');
    if(!direct.length)paragraph(root,'No direct replacement identified in the reviewed categories. Related hardware is not a replacement for this component.','service-warning');
    for(const [title,items] of [['Replacement / assembly candidates',direct],['Related items only',related],['Screened out for stated configuration',excluded]]){
      if(!items.length)continue;
      root.append(node('h4',`${title} (${items.length})`));
      for(const [index,p] of items.entries()){
        const details=node('details');details.dataset.retailerSku=p.sku;details.open=title.startsWith('Replacement')&&index===0;
        details.append(node('summary',p.title));
        sourceLink(details,{title:`Motonet product ${p.sku}`,url:p.url,checked_on:p.checked_on,availability:p.direct_product_page_checked?'product_page_and_catalogue_reviewed':'live_catalogue_card_reviewed'});
        paragraph(details,p.screening_note,'service-warning');
        for(const m of p.matches){paragraph(details,`${m.family} | ${m.relation.replaceAll('_',' ')}`);paragraph(details,m.note);}
        if(p.cross_reference_examples.length)fields(details,[['Listed cross-references (examples)',p.cross_reference_examples.join('; ')]]);
        const specs=node('details');specs.append(node('summary','Listed candidate specifications'));
        fields(specs,p.listed_fields);paragraph(specs,'Retailer fields may combine alternative application rows. Verify exact dates/VIN/equipment with the supplier.','source-date');
        details.append(specs);
        const source=p.category_evidence[0];sourceLink(details,{title:'ABL vehicle-category evidence',url:source.url,checked_on:p.checked_on,availability:'live_catalogue_reviewed'});
        root.append(details);
      }
    }
    for(const gap of research.coverage_gaps.filter(g=>g.part_ids.includes(card.part_id)))paragraph(root,gap.note,'service-warning');
    paragraph(root,'Fitment, stock, core charges and ordering quantity require confirmation. No repair torque was inferred from these listings.','source-date');
  }
  capture(card){
    const root=this.panel,c=this.catalogue,plan=c.capture_plan;
    paragraph(root,'Capture status: not captured. Geometry and placement remain estimates.','service-warning');
    const selected=new Set(card?.capture_job_ids||[]);
    const jobs=[...plan.jobs].sort((a,b)=>Number(selected.has(b.id))-Number(selected.has(a.id))||a.priority-b.priority);
    for(const job of jobs){
      const details=node('details');details.open=card?selected.has(job.id):job.priority===0;
      details.dataset.captureJob=job.id;details.append(node('summary',`${job.priority}. ${job.title}`));
      paragraph(details,job.benefit);details.append(node('h4','Photographs'));checklist(details,job.shots);
      details.append(node('h4','Measurements'));checklist(details,job.measurements);root.append(details);
    }
    const common=node('details');common.append(node('summary','Common capture checklist'));checklist(common,plan.common_checklist);root.append(common);
    const safety=node('details');safety.append(node('summary','Safety'));checklist(safety,plan.safety);root.append(safety);
    for(const id of plan.source_ids)sourceLink(root,c.sources[id]);
  }
}
