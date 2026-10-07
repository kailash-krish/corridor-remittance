'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {feature} from 'topojson-client';
import earth from 'world-atlas/countries-110m.json';
import {currency} from '@/lib/remittance/currency';
import {locationVector,makeRoute} from '@/lib/remittance/globe-route.mjs';
export default function Globe({source='AED',target='INR'}:{source?:string;target?:string}){
 const host=useRef<HTMLDivElement>(null),sourceLabel=useRef<HTMLDivElement>(null),targetLabel=useRef<HTMLDivElement>(null);
 const updateRoute=useRef<((source:string,target:string)=>void)|null>(null);const current=useRef({source,target});current.current={source,target};
 const [ready,setReady]=useState(false);const from=currency(source),to=currency(target);
 useEffect(()=>{if(!host.current)return;const el=host.current;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})}catch{return}
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.z=7.7;renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));el.appendChild(renderer.domElement);
 const group=new THREE.Group();scene.add(group);group.add(new THREE.Mesh(new THREE.SphereGeometry(1.9,64,64),new THREE.MeshPhysicalMaterial({color:'#d6e6da',roughness:.7,metalness:.12,clearcoat:.25})));
 scene.add(new THREE.AmbientLight('#ffffff',2));const light=new THREE.DirectionalLight('#ffffff',4);light.position.set(-3,4,5);scene.add(light);const fill=new THREE.DirectionalLight('#648e73',2);fill.position.set(3,-2,1);scene.add(fill);
 const point=(lon:number,lat:number)=>locationVector({lat,lon},1.915);
 const data=feature(earth as never,earth.objects.countries as never) as unknown as {features:{geometry:{type:string;coordinates:number[][][]|number[][][][]}}[]};
 const lineMat=new THREE.LineBasicMaterial({color:'#577968',transparent:true,opacity:.52});
 for(const country of data.features){const polygons=country.geometry.type==='Polygon'?[country.geometry.coordinates as number[][][]]:country.geometry.coordinates as number[][][][];for(const polygon of polygons)for(const ring of polygon)group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(p=>point(p[0],p[1]))),lineMat))}
 const gridMat=new THREE.LineBasicMaterial({color:'#7a9b86',transparent:true,opacity:.18});
 for(let lat=-60;lat<=60;lat+=20)group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:181},(_,i)=>point(i*2-180,lat))),gridMat));
 for(let lon=-180;lon<180;lon+=20)group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:91},(_,i)=>point(lon,i*2-90))),gridMat));
 const routeGroup=new THREE.Group();group.add(routeGroup);let route=makeRoute(currency(current.current.source),currency(current.current.target));
 const dispose=(o:THREE.Object3D)=>o.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();(Array.isArray(child.material)?child.material:[child.material]).forEach(m=>m.dispose())}});
 const moving=new THREE.Mesh(new THREE.SphereGeometry(.034,12,12),new THREE.MeshBasicMaterial({color:'#d69b44'}));group.add(moving);
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 updateRoute.current=(s,t)=>{dispose(routeGroup);routeGroup.clear();route=makeRoute(currency(s),currency(t));routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(route.curve,96,.015,8,false),new THREE.MeshBasicMaterial({color:'#08764e'})));for(const p of [route.start,route.end]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.05,16,16),new THREE.MeshBasicMaterial({color:'#086a47'}));dot.position.copy(p);routeGroup.add(dot);const ring=new THREE.Mesh(new THREE.TorusGeometry(.095,.009,8,32),new THREE.MeshBasicMaterial({color:'#086a47'}));ring.position.copy(p);ring.lookAt(p.clone().multiplyScalar(2));routeGroup.add(ring)}if(motion.matches)group.quaternion.copy(route.orientation)};
 updateRoute.current(current.current.source,current.current.target);group.quaternion.copy(route.orientation);
 let x=0,y=0,frame=0,visible=true;
 const resize=()=>{const w=el.clientWidth,h=Math.max(1,el.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};const ro=new ResizeObserver(resize);ro.observe(el);resize();const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting});io.observe(el);
 const pointer=(e:PointerEvent)=>{const r=el.getBoundingClientRect();x=((e.clientX-r.left)/r.width-.5)*.22;y=((e.clientY-r.top)/r.height-.5)*.12};const leave=()=>{x=0;y=0};el.addEventListener('pointermove',pointer);el.addEventListener('pointerleave',leave);
 const projected=new THREE.Vector3(),desired=new THREE.Quaternion(),tilt=new THREE.Quaternion();
 const render=(t:number)=>{frame=requestAnimationFrame(render);if(!visible)return;tilt.setFromEuler(new THREE.Euler(motion.matches?0:-y,motion.matches?0:x,0));desired.copy(tilt).multiply(route.orientation);group.quaternion.slerp(desired,motion.matches?1:.075);moving.position.copy(route.curve.getPoint(motion.matches?.5:(t*.00012)%1));group.updateMatrixWorld(true);for(const [p,label] of [[route.start,sourceLabel.current],[route.end,targetLabel.current]] as const){if(!label)continue;projected.copy(p).applyMatrix4(group.matrixWorld);label.style.opacity=projected.z>0?'1':'0';projected.project(camera);label.style.transform=`translate(${(projected.x*.5+.5)*el.clientWidth}px,${(-projected.y*.5+.5)*el.clientHeight}px) translate(-50%,-145%)`}renderer.render(scene,camera)};frame=requestAnimationFrame(render);setReady(true);
 return()=>{updateRoute.current=null;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();el.removeEventListener('pointermove',pointer);el.removeEventListener('pointerleave',leave);dispose(scene);renderer.dispose();renderer.domElement.remove()};
 },[]);
 useEffect(()=>{updateRoute.current?.(source,target)},[source,target]);
 return <div className="globe-stage" role="img" aria-label={`Globe route from ${from.city}, ${source}, to ${to.city}, ${target}`} data-source={source} data-target={target}><div className="globe-orbit orbit-one"/><div className="globe-orbit orbit-two"/><div ref={host} className="globe-canvas"/>{!ready&&<div className="globe-fallback"><span>{from.city} → {to.city}</span></div>}<div ref={sourceLabel} className="geo-label route-label"><i/>{from.city}<span>{source}</span></div><div ref={targetLabel} className="geo-label route-label"><i/>{to.city}<span>{target}</span></div><div className="globe-caption">Representative currency locations{source==='EUR'||target==='EUR'?' · EUR shown at Frankfurt':''}</div></div>
}
