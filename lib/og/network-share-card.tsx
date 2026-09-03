import { ImageResponse } from 'next/og';

export type NetworkCardModel = { kind?: string; eyebrow?: string; title: string; subtitle?: string; fact?: string };
export type NetworkCardConfig = { hub: string; descriptor: string; domain: string; accent: string };
export const NETWORK_OG_SIZE = { width: 1200, height: 630 };

function textSize(value: string) { return value.length > 64 ? 32 : value.length > 46 ? 38 : 44; }

export function renderNetworkShareImage(config: NetworkCardConfig, model?: NetworkCardModel) {
  const context = model && model.kind !== 'fallback';
  const title = context ? model.title : config.descriptor;
  const eyebrow = context ? (model.eyebrow || 'EVIDENCE SUMMARY') : 'THE TRUST HUB NETWORK';
  const supporting = context ? (model.subtitle || model.fact) : undefined;
  const nodes = [[100,128,8],[92,238,5],[106,414,7],[1090,151,6],[1100,304,8],[1087,465,5]];
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',position:'relative',overflow:'hidden',alignItems:'center',justifyContent:'center',background:'radial-gradient(circle at 50% 42%, #0b2743 0%, #06182c 40%, #020b1d 72%, #020817 100%)',color:'#fff',fontFamily:'Georgia, serif'}}>
      <div style={{position:'absolute',inset:0,display:'flex',background:`radial-gradient(circle at 50% 48%, ${config.accent}25 0%, transparent 44%)`}} />
      <div style={{position:'absolute',left:156,top:48,width:74,height:502,borderLeft:`3px solid ${config.accent}`,borderTop:`3px solid ${config.accent}`,borderBottom:`3px solid ${config.accent}`,opacity:.9}} />
      <div style={{position:'absolute',right:156,top:48,width:74,height:502,borderRight:`3px solid ${config.accent}`,borderTop:`3px solid ${config.accent}`,borderBottom:`3px solid ${config.accent}`,opacity:.9}} />
      {nodes.map(([left,top,size],i)=><div key={i} style={{position:'absolute',left,top,width:size,height:size,borderRadius:99,background:i%2? '#38bdf8':config.accent,boxShadow:`0 0 18px ${config.accent}`,opacity:.72}} />)}
      <div style={{width:820,height:520,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',zIndex:2}}>
        <div style={{display:'flex',fontFamily:'Arial, sans-serif',fontSize:16,fontWeight:700,letterSpacing:5,color:config.accent,textTransform:'uppercase',maxWidth:760}}>{eyebrow}</div>
        <div style={{display:'flex',fontSize:72,fontWeight:700,letterSpacing:-2,lineHeight:1.05,marginTop:23,textTransform:'uppercase'}}>{config.hub}</div>
        <div style={{display:'flex',maxWidth:760,fontSize:textSize(title),fontWeight:600,lineHeight:1.12,marginTop:22,justifyContent:'center'}}>{title}</div>
        {supporting ? <div style={{display:'flex',maxWidth:720,fontFamily:'Arial, sans-serif',fontSize:21,lineHeight:1.3,color:'#cbd5e1',marginTop:14}}>{supporting}</div> : null}
        <div style={{display:'flex',width:342,height:2,background:config.accent,marginTop:28,opacity:.9}} />
        <div style={{display:'flex',fontFamily:'Arial, sans-serif',fontSize:24,fontWeight:600,letterSpacing:2,color:'#e2e8f0',marginTop:20}}>{config.domain}</div>
      </div>
    </div>,
    { ...NETWORK_OG_SIZE, headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'X-TrustHub-Card-Revision': 'share-004b-v1' } },
  );
}

