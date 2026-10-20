import {ServicePanel} from './release-2026-10-20/service.mjs';

// Keep the frozen renderer/torque guard while limiting tab controls to this app.
export class ScopedServicePanel extends ServicePanel {
  constructor(root,panel){super(panel);this.root=root;}
  motonet(card){
    super.motonet(card);
    if(card||!this.catalogue?.retailer_research)return;
    const firstGap=this.panel.querySelector('h4');
    if(!firstGap)return;
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent='Unmapped component families';details.append(summary);
    for(let node=firstGap;node;){const next=node.nextSibling;details.append(node);node=next;}
    this.panel.append(details);
  }
  setTab(tab){
    if(!['part','fasteners','capture','motonet'].includes(tab))return;
    this.tab=tab;
    for(const button of this.root.querySelectorAll('[data-service-tab]')){
      const active=button.dataset.serviceTab===tab;
      button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    }
    this.panel.setAttribute('aria-labelledby',`service-tab-${tab}`);this.render();
  }
}

export function matchingCatalogue(catalogue,manifest){
  return catalogue?.schema_version===1&&catalogue.model===manifest.model&&
    catalogue.model_revision===manifest.model_revision&&catalogue.summary?.part_count===manifest.part_count&&
    Object.keys(catalogue.parts||{}).length===manifest.part_count&&
    manifest.parts.every(part=>{
      const card=catalogue.parts[part.id];
      return card?.part_id===part.id&&Array.isArray(card.examples)&&Array.isArray(card.joint_ids)&&
        Array.isArray(card.research_source_ids)&&Array.isArray(card.capture_job_ids);
    });
}
