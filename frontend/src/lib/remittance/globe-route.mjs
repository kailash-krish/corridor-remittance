import * as THREE from 'three';
export function locationVector(location,radius=1.94){const lat=location.lat*Math.PI/180,lon=location.lon*Math.PI/180;return new THREE.Vector3(radius*Math.cos(lat)*Math.sin(lon),radius*Math.sin(lat),radius*Math.cos(lat)*Math.cos(lon))}
export function makeRoute(source,target){const a=locationVector(source).normalize(),b=locationVector(target).normalize(),angle=Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1));const axis=new THREE.Vector3().crossVectors(a,b);if(axis.length()<1e-6)axis.crossVectors(a,new THREE.Vector3(0,1,0));axis.normalize();
 class Arc extends THREE.Curve {getPoint(t){return a.clone().applyAxisAngle(axis,angle*t).multiplyScalar(1.94+Math.sin(Math.PI*t)*(.18+angle*.18))}}
 const curve=new Arc();const center=curve.getPoint(.5).normalize();const orientation=new THREE.Quaternion().setFromUnitVectors(center,new THREE.Vector3(0,0,1));return {curve,orientation,start:locationVector(source),end:locationVector(target)};
}
