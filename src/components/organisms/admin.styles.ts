// Inline page-owned styles keep the optional workspace out of shared site CSS.
export const adminStyles: string = `
.admin-auth{display:grid;place-items:center;min-height:calc(100vh - 5rem);padding:var(--m3e-space-6);background:var(--surface);color:var(--on-surface)}.admin-auth-card{width:min(100%,28rem);box-sizing:border-box}.admin-auth-card h1{font:var(--m3e-type-headline-medium);margin:0 0 var(--m3e-space-4)}.admin-auth-form{display:flex;flex-direction:column;gap:var(--m3e-space-3);margin-top:var(--m3e-space-6)}.admin-auth-form input{box-sizing:border-box;width:100%;min-height:3rem;padding:var(--m3e-space-3);border:1px solid var(--outline-variant);border-radius:var(--shape-corner-m);background:var(--surface-container-low);color:var(--on-surface);font:var(--m3e-type-body-large)}.admin-auth-form input:focus-visible{outline:2px solid var(--primary);outline-offset:2px}.admin-auth-actions{display:flex;justify-content:flex-end;margin-bottom:var(--m3e-space-3)}
.admin-workspace{display:grid;grid-template-columns:14rem minmax(0,1fr);min-height:calc(100vh - 5rem);background:var(--surface);color:var(--on-surface);font:var(--m3e-type-body-large)}
.admin-workspace *{box-sizing:border-box}
.admin-sidebar{padding:var(--m3e-space-6) var(--m3e-space-4);border-right:1px solid var(--outline-variant);display:flex;flex-direction:column;gap:var(--m3e-space-4);background:var(--surface-container-lowest)}
.admin-eyebrow{font:var(--m3e-type-label-large);color:var(--primary);margin:0 0 var(--m3e-space-3)}
.admin-sidebar .admin-eyebrow{padding:0 var(--m3e-space-3)}
.admin-sidebar nav{display:grid;gap:var(--m3e-space-2)}
.admin-nav-item{position:relative;display:flex;align-items:center;gap:var(--m3e-space-3);padding:var(--m3e-space-3);min-height:3rem;background:transparent;border:0;border-radius:var(--shape-corner-l);color:var(--on-surface-variant);font:var(--m3e-type-label-large);cursor:pointer;text-align:left;--m3e-state-color:var(--on-surface)}
.admin-nav-item.active{background:var(--secondary-container);color:var(--on-secondary-container)}
.admin-nav-item svg{flex-shrink:0}.admin-count{margin-left:auto;font:var(--m3e-type-label-medium)}
.admin-return{position:relative;margin-top:auto;padding:var(--m3e-space-3);display:flex;justify-content:space-between;border-radius:var(--shape-corner-m);font:var(--m3e-type-label-large);color:var(--primary)}
.admin-main{padding:var(--m3e-space-8);max-width:90rem;width:100%;min-width:0;margin:0 auto}
.admin-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--m3e-space-4);margin-bottom:var(--m3e-space-6)}
.admin-heading h1{font:var(--m3e-type-headline-large);font-weight:600;margin:0}
.admin-subtitle{color:var(--on-surface-variant);margin:var(--m3e-space-2) 0 0}
.admin-mode{display:flex;align-items:center;gap:var(--m3e-space-3);font:var(--m3e-type-body-medium);color:var(--on-secondary-container);background:var(--secondary-container);padding:var(--m3e-space-4);border-radius:var(--shape-corner-l);margin:0 0 var(--m3e-space-6)}
.admin-mode svg{flex-shrink:0}
.admin-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--m3e-space-4);margin-bottom:var(--m3e-space-6)}
.admin-stat{display:flex;align-items:center;gap:var(--m3e-space-4);padding:var(--m3e-space-6);border-radius:var(--shape-corner-l);background:var(--surface-container-lowest);border:1px solid var(--outline-variant)}
.admin-stat-icon,.admin-article-icon{display:grid;place-items:center;flex-shrink:0;width:3rem;height:3rem;border-radius:var(--shape-corner-m);background:var(--primary-container);color:var(--on-primary-container)}
.admin-stat p{font:var(--m3e-type-label-large);margin:0;color:var(--on-surface-variant)}
.admin-stat strong{font:var(--m3e-type-headline-large);font-weight:600}
.admin-panel{background:var(--surface-container-lowest);border:1px solid var(--outline-variant);border-radius:var(--shape-corner-l);padding:var(--m3e-space-6)}
.admin-panel h2{font:var(--m3e-type-title-large);margin:0}
.admin-list-heading{display:flex;align-items:center;gap:var(--m3e-space-4);flex-wrap:wrap;margin-bottom:var(--m3e-space-4)}
.admin-search{margin-left:auto;width:min(100%,20rem)}
.admin-category-filter{width:min(100%,11rem);min-width:0;flex-shrink:1}.admin-category-filter .m3-select{width:100%;min-width:0;font:var(--m3e-type-body-medium)}.admin-workspace .admin-category-filter .m3-select.m3-select--filled .m3-select__field{height:3rem;min-height:3rem;max-height:3rem;border-radius:var(--shape-corner-m);overflow:hidden;padding:0 var(--m3e-space-3);gap:var(--m3e-space-2)}.admin-category-filter .m3-select__label{top:var(--m3e-space-1);font:var(--m3e-type-label-small)}.admin-category-filter .m3-select__value{padding-top:var(--m3e-space-4);padding-bottom:var(--m3e-space-1)}.admin-category-filter .m3-select__leading:empty{display:none}.admin-batch-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:var(--m3e-space-3);padding:var(--m3e-space-3);margin-bottom:var(--m3e-space-3);border-radius:var(--shape-corner-m);background:var(--surface-container-low)}.admin-article-actions{display:flex;align-items:center;flex-shrink:0}.admin-article-actions button{min-width:0}.admin-batch-toolbar .admin-helper{margin-right:auto}
@media(max-width:700px){.admin-category-filter{width:min(100%,11rem);order:4}.admin-batch-toolbar{gap:var(--m3e-space-2)}.admin-article-actions{flex-direction:column}}
.admin-article-list{list-style:none;padding:0;margin:0}
.admin-article-list li{display:flex;align-items:center;gap:var(--m3e-space-4);padding:var(--m3e-space-4) 0;border-top:1px solid var(--outline-variant)}
.admin-article-info{min-width:0;flex:1}.admin-article-title{display:block;font:var(--m3e-type-title-medium);font-weight:600;color:var(--on-surface);border:0;background:none;padding:0;cursor:pointer;max-width:100%;text-align:left;overflow-wrap:anywhere}
.admin-article-info p{display:flex;gap:var(--m3e-space-2);flex-wrap:wrap;font:var(--m3e-type-body-small);color:var(--on-surface-variant);margin:var(--m3e-space-1) 0 0}
.admin-status{font:var(--m3e-type-label-medium);white-space:nowrap;border-radius:var(--shape-corner-full);padding:var(--m3e-space-1) var(--m3e-space-3);background:var(--secondary-container);color:var(--on-secondary-container)}
.admin-status.draft{background:var(--tertiary-container);color:var(--on-tertiary-container)}
.admin-empty{padding:var(--m3e-space-8) 0;text-align:center;color:var(--on-surface-variant)}
.admin-editor{margin-top:var(--m3e-space-4)}.admin-editor-grid{display:grid;grid-template-columns:minmax(0,1fr) 19rem;gap:var(--m3e-space-4)}
.admin-writing,.admin-metadata{min-width:0;display:flex;flex-direction:column;gap:var(--m3e-space-3)}
.admin-workspace label{font:var(--m3e-type-label-large);color:var(--on-surface-variant)}
/* Native editor controls own these styles; shared TextField manages its own surface and focus. */
.admin-workspace :is(.admin-editor,.admin-config-search) input:not([type=checkbox]),.admin-workspace textarea{width:100%;min-width:0;border:1px solid var(--outline-variant);border-radius:var(--shape-corner-m);padding:var(--m3e-space-3);color:var(--on-surface);background:var(--surface-container-low);font:var(--m3e-type-body-large)}
.admin-workspace :is(.admin-editor,.admin-config-search) input:not([type=checkbox]){min-height:3rem}.admin-workspace textarea{resize:vertical}
.admin-workspace :is(.admin-editor,.admin-config-search) input:focus-visible,.admin-workspace textarea:focus-visible,.admin-article-title:focus-visible,.admin-source-tabs button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.admin-workspace input.admin-title-input{font:var(--m3e-type-title-large)}
.admin-source-tabs{display:flex;border-bottom:1px solid var(--outline-variant);gap:var(--m3e-space-2)}
.admin-source-tabs button{position:relative;border:0;border-radius:var(--shape-corner-m) var(--shape-corner-m) 0 0;padding:var(--m3e-space-3);font:var(--m3e-type-label-large);background:transparent;color:var(--on-surface-variant);cursor:pointer}
.admin-source-tabs button[aria-pressed=true]{color:var(--on-primary-container);border-bottom:2px solid var(--primary);background:var(--primary-container)}
.admin-workspace textarea.admin-body{min-height:26rem;font-family:var(--font-mono);line-height:1.7}
.admin-preview{min-height:26rem;overflow-wrap:anywhere;line-height:1.7}.admin-preview h1,.admin-preview h2,.admin-preview h3{font-weight:600;margin:var(--m3e-space-4) 0}.admin-preview pre{overflow:auto;background:var(--surface-container);padding:var(--m3e-space-4);border-radius:var(--shape-corner-m)}.admin-preview ul{list-style:disc;padding-left:var(--m3e-space-6)}.admin-preview a{color:var(--primary);text-decoration:underline}
.admin-helper{font:var(--m3e-type-body-small);color:var(--on-surface-variant);margin:0}.admin-metadata code{font:var(--m3e-type-body-small);overflow-wrap:anywhere}
.admin-toggle{display:flex;align-items:center;justify-content:space-between;gap:var(--m3e-space-3);font:var(--m3e-type-label-large);padding-top:var(--m3e-space-2)}
.admin-feedback{padding:var(--m3e-space-4);border-radius:var(--shape-corner-m);background:var(--secondary-container);color:var(--on-secondary-container);margin-top:var(--m3e-space-4)}.admin-error{background:var(--error-container);color:var(--on-error-container)}
.admin-sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.admin-config-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));gap:var(--m3e-space-4)}
.admin-config-card{position:relative;display:flex;align-items:flex-start;flex-direction:column;gap:var(--m3e-space-3);text-align:left;color:var(--on-surface);cursor:pointer;--m3e-state-color:var(--on-surface)}
.admin-config-card p{font:var(--m3e-type-body-small);color:var(--on-surface-variant);margin:0;overflow-wrap:anywhere}.admin-config-card:disabled{opacity:.5;cursor:default}
.admin-config-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--m3e-space-6);margin:var(--m3e-space-4) 0}
.admin-config-field{min-width:0;display:flex;flex-direction:column;gap:var(--m3e-space-2);overflow-wrap:anywhere}.admin-field-wide{grid-column:1/-1}.admin-config-field .admin-field-title{font:var(--m3e-type-title-medium)}
.admin-config-intro{margin-top:var(--m3e-space-4)}.admin-config-search{display:flex;flex-direction:column;gap:var(--m3e-space-2);margin-bottom:var(--m3e-space-6)}
.admin-workspace select{width:100%;min-height:3rem;border:1px solid var(--outline-variant);border-radius:var(--shape-corner-m);padding:var(--m3e-space-3);font:var(--m3e-type-body-large);background:var(--surface-container-low);color:var(--on-surface)}.admin-workspace select:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.admin-value-label{font:var(--m3e-type-label-medium);color:var(--primary)}.admin-technical code{font-family:var(--font-mono);overflow-wrap:anywhere}
.admin-image-preview{display:flex;align-items:center;justify-content:center;min-height:5rem;padding:var(--m3e-space-2);border:1px solid var(--outline-variant);border-radius:var(--shape-corner-m);background:var(--surface-container-low);overflow:hidden}.admin-image-preview img{display:block;max-width:100%;width:auto;height:auto;max-height:10rem;object-fit:contain;border-radius:var(--shape-corner-s)}
.admin-array-item{border:1px solid var(--outline-variant);border-radius:var(--shape-corner-m);padding:var(--m3e-space-4);margin-bottom:var(--m3e-space-3)}.admin-array-item summary{cursor:pointer;font:var(--m3e-type-title-medium)}
.admin-diagnostics{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--font-mono);font-size:var(--m3e-type-body-small-font-size, .875rem)}
.admin-config-card:focus-visible,.admin-array-item summary:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
@media(max-width:700px){.admin-config-fields{grid-template-columns:minmax(0,1fr)}.admin-field-wide{grid-column:auto}}
@media(max-width:1100px){.admin-workspace{grid-template-columns:12rem minmax(0,1fr)}.admin-main{padding:var(--m3e-space-6)}.admin-editor-grid{grid-template-columns:minmax(0,1fr)}.admin-stat{padding:var(--m3e-space-4)}.admin-stat-icon{display:none}}
@media(max-width:700px){.admin-workspace{display:block}.admin-sidebar{padding:var(--m3e-space-3);border-right:0;border-bottom:1px solid var(--outline-variant)}.admin-sidebar>.admin-eyebrow,.admin-return{display:none}.admin-sidebar nav{grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--m3e-space-1)}.admin-nav-item{justify-content:center;padding:var(--m3e-space-2);gap:var(--m3e-space-1)}.admin-nav-item svg,.admin-count{display:none}.admin-main{padding:var(--m3e-space-4)}.admin-heading{align-items:flex-start;flex-wrap:wrap}.admin-stats{gap:var(--m3e-space-2)}.admin-stat{padding:var(--m3e-space-3)}.admin-stat p{font:var(--m3e-type-label-medium)}.admin-stat strong{font:var(--m3e-type-headline-small)}.admin-panel{padding:var(--m3e-space-4)}.admin-search{margin:0;width:100%;order:3}.admin-list-heading h2{flex:1}.admin-article-list li{gap:var(--m3e-space-2)}.admin-article-icon{display:none}.admin-status{padding:var(--m3e-space-1) var(--m3e-space-2)}.admin-mode{align-items:flex-start}}
`;
