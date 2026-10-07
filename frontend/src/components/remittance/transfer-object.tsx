'use client';
import {useEffect,useRef,useState} from 'react';
import {RotateCcw,MoveHorizontal,Pause,Play} from 'lucide-react';
import * as THREE from 'three';

/** Original geometry. No remote model, tracking embed, or third-party scene dependency. */
export default function TransferObject({phase=0,compact=false}:{phase?:number;compact?:boolean}) {
 const host=useRef<HTMLDivElement>(null);
 const target=useRef(phase);const interaction=useRef({x:0,y:0,paused:false});
 const [ready,setReady]=useState(false);const [paused,setPaused]=useState(false);
 useEffect(()=>{target.current=phase},[phase]);
 useEffect(()=>{const el=host.current;if(!el)return;
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})}catch{return}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,40);camera.position.set(0,0,8.5);
  const rig=new THREE.Group();scene.add(rig);rig.rotation.set(.18,-.35,-.1);
  scene.add(new THREE.AmbientLight('#e8f4dd',2.6));
  for(const [color,intensity,x,y,z] of [['#f4eed6',7,-3,5,4],['#b7efc1',5,4,1,2],['#fce7b3',5,0,-4,1]] as const){const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light)}
  const pearl=new THREE.MeshPhysicalMaterial({color:'#baceb4',metalness:.35,roughness:.25,clearcoat:1});
  const green=new THREE.MeshPhysicalMaterial({color:'#1e8060',metalness:.5,roughness:.22,clearcoat:1});
  const gold=new THREE.MeshPhysicalMaterial({color:'#ccb581',metalness:.6,roughness:.28,clearcoat:1});
  const rings=[1.56,1.95].map((r,i)=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,i?.075:.19,24,128),i?gold:pearl);mesh.rotation.y=i?-.8:.55;mesh.rotation.x=i?.7:-.2;rig.add(mesh);return mesh});
  const orbit=new THREE.Group();rig.add(orbit);
  for(let i=0;i<3;i++){const bead=new THREE.Mesh(new THREE.SphereGeometry(.09,18,18),gold);const a=i*Math.PI*2/3;bead.position.set(Math.cos(a)*1.95,Math.sin(a)*1.95,0);orbit.add(bead)}
  const token=new THREE.Group();rig.add(token);
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(.91,.91,.16,72),green);coin.rotation.x=Math.PI/2;token.add(coin);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.85,.024,10,72),gold);rim.position.z=.095;token.add(rim);
  const face=document.createElement('canvas');face.width=512;face.height=512;const ctx=face.getContext('2d');
  const texture=new THREE.CanvasTexture(face);texture.colorSpace=THREE.SRGBColorSpace;
  const front=new THREE.Mesh(new THREE.CircleGeometry(.81,64),new THREE.MeshBasicMaterial({map:texture,transparent:true}));front.position.z=.09;token.add(front);
  function drawFace(label:string){if(!ctx)return;ctx.clearRect(0,0,512,512);ctx.textAlign='center';ctx.fillStyle='#e8edcd';ctx.font='500 110px sans-serif';ctx.fillText(label,256,284);ctx.font='20px sans-serif';ctx.fillStyle='#adc6a6';ctx.fillText('C O R R I D O R',256,355);ctx.strokeStyle='#8da78c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(125,154);ctx.lineTo(387,154);ctx.stroke();texture.needsUpdate=true;}
  let label='AED';drawFace(label);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,visible=true,dragging=false,startX=0,startY=0,last=0,current=phase;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.position.z=w/h<.8?10:8.5;camera.updateProjectionMatrix()};const ro=new ResizeObserver(resize);ro.observe(el);resize();
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting});observer.observe(el);
  const down=(e:PointerEvent)=>{dragging=true;startX=e.clientX;startY=e.clientY;el.setPointerCapture(e.pointerId);el.classList.add('dragging')};
  const move=(e:PointerEvent)=>{if(!dragging)return;interaction.current.x+=(e.clientX-startX)*.008;interaction.current.y=Math.max(-.7,Math.min(.7,interaction.current.y+(e.clientY-startY)*.004));startX=e.clientX;startY=e.clientY};
  const up=()=>{dragging=false;el.classList.remove('dragging')};
  const key=(e:KeyboardEvent)=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home'){interaction.current.x=0;interaction.current.y=0}else if(e.key==='ArrowLeft')interaction.current.x-=.2;else if(e.key==='ArrowRight')interaction.current.x+=.2;else interaction.current.y+=e.key==='ArrowUp'?-.1:.1;}};
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('keydown',key);
  const render=(t:number)=>{frame=requestAnimationFrame(render);if(!visible||document.hidden)return;if(t-last<32)return;last=t;const moving=!reduced.matches&&!interaction.current.paused;current+=(target.current-current)*(reduced.matches?1:.06);const time=moving?t*.0003:0;
   rig.rotation.y=THREE.MathUtils.lerp(rig.rotation.y,interaction.current.x-.35+(moving?Math.sin(time)*.12:0),.08);rig.rotation.x=THREE.MathUtils.lerp(rig.rotation.x,interaction.current.y+.18,.08);
   token.rotation.y=current*Math.PI;token.position.y=moving?Math.sin(time*2)*.08:0;token.position.z=.3+Math.sin(current*Math.PI/2)*.2;
   // Show the correct face on both sides during the middle escrow phase.
   front.rotation.y=current>.5&&current<1.5?Math.PI:0;front.position.z=current>.5&&current<1.5?-.09:.09;
   rings[0].rotation.y=.55-current*.7; rings[1].rotation.z=current*.7+(moving?time*.18:0);orbit.rotation.copy(rings[1].rotation);
   const next=current<.55?'AED':current<1.5?'RMTS':'INR';if(next!==label){label=next;drawFace(label)}
   renderer.render(scene,camera);
  };frame=requestAnimationFrame(render);setReady(true);
  return()=>{cancelAnimationFrame(frame);ro.disconnect();observer.disconnect();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('keydown',key);const materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))}});materials.forEach(m=>m.dispose());texture.dispose();renderer.dispose();renderer.domElement.remove()};
 // Scene lifetime is independent of the phase, which is updated through a ref.
 },[]);
 return <div className={`transfer-object ${compact?'compact':''}`}><div className="object-aura"/><div ref={host} className="object-canvas" tabIndex={0} role="group" aria-label="Interactive 3D transfer token. Drag or use arrow keys to rotate. Home resets the view."/>{!ready&&<div className="object-fallback" aria-hidden="true"><span>{phase<.5?'AED':phase<1.5?'RMTS':'INR'}</span></div>}<div className="object-controls"><span><MoveHorizontal size={13}/>Drag to explore</span><button type="button" aria-label="Reset 3D object rotation" onClick={()=>{interaction.current.x=0;interaction.current.y=0}}><RotateCcw size={14}/></button><button type="button" aria-label={paused?'Resume 3D motion':'Pause 3D motion'} aria-pressed={paused} onClick={()=>{interaction.current.paused=!paused;setPaused(!paused)}}>{paused?<Play size={14}/>:<Pause size={14}/>}</button></div></div>
}
