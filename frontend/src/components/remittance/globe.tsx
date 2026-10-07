'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {feature} from 'topojson-client';
import earth from 'world-atlas/countries-110m.json';
export default function Globe(){
 const host=useRef<HTMLDivElement>(null);const [ready,setReady]=useState(false);
 useEffect(()=>{if(!host.current)return;const el=host.current;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return;}
 const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.z=7.2;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));el.appendChild(renderer.domElement);
 const group=new THREE.Group();scene.add(group);group.rotation.z=-.16;
 const sphere=new THREE.Mesh(new THREE.SphereGeometry(1.9,64,64),new THREE.MeshPhysicalMaterial({color:'#d6e6da',roughness:.7,metalness:.12,clearcoat:.25}));group.add(sphere);
 scene.add(new THREE.AmbientLight('#ffffff',2));const light=new THREE.DirectionalLight('#ffffff',4);light.position.set(-3,4,5);scene.add(light);const fill=new THREE.DirectionalLight('#648e73',2);fill.position.set(3,-2,1);scene.add(fill);
 const point=(lon:number,lat:number,r=1.915)=>{const a=(lon-65)*Math.PI/180,b=lat*Math.PI/180;return new THREE.Vector3(r*Math.cos(b)*Math.sin(a),r*Math.sin(b),r*Math.cos(b)*Math.cos(a));};
 // Natural Earth outlines, transformed to geographic coordinates on the sphere.
 const data=feature(earth as never,earth.objects.countries as never) as unknown as {features:{geometry:{type:string;coordinates:number[][][]|number[][][][]}}[]};
 const lineMat=new THREE.LineBasicMaterial({color:'#577968',transparent:true,opacity:.52});
 for(const country of data.features){const polygons=country.geometry.type==='Polygon'?[country.geometry.coordinates as number[][][]]:country.geometry.coordinates as number[][][][];for(const polygon of polygons){for(const ring of polygon){const points=ring.map(p=>point(p[0],p[1]));group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lineMat));}}}
 const gridMat=new THREE.LineBasicMaterial({color:'#7a9b86',transparent:true,opacity:.18});
 for(let lat=-60;lat<=60;lat+=20){group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:181},(_,i)=>point(i*2-180,lat))),gridMat));}
 for(let lon=-180;lon<180;lon+=20){group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:91},(_,i)=>point(lon,i*2-90))),gridMat));}
 const a=point(55.27,25.2,1.94),b=point(76.27,9.93,1.94),mid=a.clone().add(b).normalize().multiplyScalar(2.55);const curve=new THREE.QuadraticBezierCurve3(a,mid,b);
 group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,64,.018,8,false),new THREE.MeshBasicMaterial({color:'#08764e'})));
 const dotMat=new THREE.MeshBasicMaterial({color:'#086a47'});[a,b].forEach(p=>{const dot=new THREE.Mesh(new THREE.SphereGeometry(.05,16,16),dotMat);dot.position.copy(p);group.add(dot);const ring=new THREE.Mesh(new THREE.TorusGeometry(.095,.009,8,32),dotMat);ring.position.copy(p);ring.lookAt(p.clone().multiplyScalar(2));group.add(ring);});
 const moving=new THREE.Mesh(new THREE.SphereGeometry(.034,12,12),new THREE.MeshBasicMaterial({color:'#e8ad57'}));group.add(moving);
 let x=0,y=0,frame=0,visible=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(el);resize();
 const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting});io.observe(el);
 const pointer=(e:PointerEvent)=>{const r=el.getBoundingClientRect();x=((e.clientX-r.left)/r.width-.5)*.25;y=((e.clientY-r.top)/r.height-.5)*.12;};el.addEventListener('pointermove',pointer);
 const render=(t:number)=>{frame=requestAnimationFrame(render);if(!visible)return;if(!reduced){group.rotation.y+=(x-group.rotation.y)*.035;group.rotation.x+=(-y-group.rotation.x)*.035;moving.position.copy(curve.getPoint((t*.00016)%1));}else moving.position.copy(curve.getPoint(.5));renderer.render(scene,camera);};frame=requestAnimationFrame(render);setReady(true);
 return()=>{cancelAnimationFrame(frame);ro.disconnect();io.disconnect();el.removeEventListener('pointermove',pointer);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="globe-stage" role="img" aria-label="Interactive three-dimensional globe showing the route from Dubai to Kerala"><div className="globe-orbit orbit-one"/><div className="globe-orbit orbit-two"/><div ref={host} className="globe-canvas"/>{!ready&&<div className="globe-fallback"/>}<div className="geo-label dubai"><i/>Dubai <span>AED</span></div><div className="geo-label india"><i/>Kerala <span>INR</span></div><div className="globe-caption">A shorter path to the people who matter.</div></div>
}
