window.addEventListener('error',function(e){var d=document.getElementById('offline');d.style.display='flex';d.innerHTML='<div>Something went wrong:<br><small>'+(e.message||'error')+' (line '+(e.lineno||'?')+')</small><br><br>Please reload, and send me this message.</div>';});
(function(){'use strict';
if(!window.THREE){document.getElementById('offline').style.display='flex';return;}
const T3=THREE,$=id=>document.getElementById(id);
/* ============ CONFIG ============ */
const CFG={step:1/120,vmax:22,v0:3,Pmax:430000,accMax:2.0,mass:9000,paxKg:75,g:9.81,rho:1.2,Cd:.9,A:9,croll:.012,
 brakeMax:4.2,brakeUp:1.8,brakeDown:3,coast:.5,aLat:1.8,harsh:3.5,jerkLim:4,crestG:2.2,regen:3.5,steadyT:8,
 stop:30,tipBase:40,perfect:1.5,dock:14,joint:12,wetGrip:.7,lowComfort:35,
 pax0:8,paxCap:16,
 sky:{dayTop:0x4aa8e0,dayHor:0xffd9a8,nightTop:0x070b24,nightHor:0x1a2142,warm:0xff9a5a,violet:0x8a5aa0},
 q:[{pr:.7,sh:false,cl:30},{pr:1,sh:true,cl:55},{pr:2,sh:true,cl:80}]};
/* ============ UTILS ============ */
function rng(a){a>>>=0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t,damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt)),sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mem={};const store={get(k){try{return localStorage.getItem(k)}catch(e){return mem[k]||null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){mem[k]=v}}};
let SV={tips:0,best:0,up:{},set:{vol:.8,music:.6,sfx:.9,subs:1,q:-1,rm:matchMedia('(prefers-reduced-motion:reduce)').matches?1:0}};
try{const o=JSON.parse(store.get('cloudtram1')||'null');if(o){SV.tips=o.tips|0;SV.best=o.best|0;SV.up=o.up||{};Object.assign(SV.set,o.set||{});}}catch(e){}
const save=()=>store.set('cloudtram1',JSON.stringify(SV));
let muted=false;
/* ============ RENDERER / SCENE ============ */
const R=new T3.WebGLRenderer({canvas:$('c'),antialias:true,powerPreference:'high-performance'});
R.outputEncoding=T3.sRGBEncoding;R.toneMapping=T3.ACESFilmicToneMapping;R.toneMappingExposure=1.05;R.shadowMap.enabled=true;R.shadowMap.type=T3.PCFSoftShadowMap;
const scene=new T3.Scene(),cam=new T3.PerspectiveCamera(55,1,.5,2600);
scene.fog=new T3.Fog(0xffc79a,120,1150);scene.add(cam);
const hemi=new T3.HemisphereLight(0xcfe8ff,0x9a7a5a,.8),sunL=new T3.DirectionalLight(0xfff0d0,1.4);
sunL.castShadow=true;sunL.shadow.mapSize.set(2048,2048);{const c=sunL.shadow.camera;c.left=c.bottom=-26;c.right=c.top=26;c.near=1;c.far=220;}sunL.shadow.bias=-.0006;
scene.add(hemi,sunL,sunL.target);
const cabin=new T3.PointLight(0xffc880,0,16);
const GRAD=new T3.DataTexture(new Uint8Array([75,140,205,255]),4,1,T3.LuminanceFormat);GRAD.minFilter=GRAD.magFilter=T3.NearestFilter;GRAD.needsUpdate=true;
const toon=(c,o)=>new T3.MeshToonMaterial(Object.assign({color:c,gradientMap:GRAD},o||{}));
function canv(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new T3.CanvasTexture(c);t.encoding=T3.sRGBEncoding;return t;}
const glowTex=canv(64,64,g=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.3,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);});
const glowMat=c=>new T3.SpriteMaterial({map:glowTex,color:c,blending:T3.AdditiveBlending,transparent:true,depthWrite:false,fog:false});
const lampGlow=glowMat(0xffc060),sunGlow=glowMat(0xffd080);
function glow(m,x,y,z,s,p){const sp=new T3.Sprite(m);sp.position.set(x,y,z);sp.scale.set(s,s,1);(p||scene).add(sp);return sp;}
const mesh=(g,m,x,y,z,p)=>{const o=new T3.Mesh(g,m);o.position.set(x||0,y||0,z||0);if(p)p.add(o);return o;};
const bx=(w,h,d,m,x,y,z,p)=>mesh(new T3.BoxGeometry(w,h,d),m,x,y,z,p);
/* ============ SKY / SEA ============ */
const skyM=new T3.ShaderMaterial({side:T3.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new T3.Color()},hor:{value:new T3.Color()},sd:{value:new T3.Vector3(0,1,0)},sc:{value:new T3.Color()}},
vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
fragmentShader:'uniform vec3 top,hor,sd,sc;varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y;vec3 c=mix(hor,top,pow(clamp(h,0.,1.),.55));if(h<0.)c=mix(hor,hor*.7,clamp(-h*4.,0.,1.));float s=dot(d,sd);c+=sc*(smoothstep(.9987,.9996,s)*2.+pow(max(s,0.),10.)*.35+pow(max(s,0.),180.)*.8);float m=dot(d,-sd);c+=vec3(.85,.9,1.)*smoothstep(.9992,.9997,m)*.9;gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'});
const sky=new T3.Mesh(new T3.SphereGeometry(2000,32,16),skyM);sky.renderOrder=-2;sky.frustumCulled=false;scene.add(sky);
const starG=new T3.BufferGeometry(),sp=[],rs=rng(7);for(let i=0;i<500;i++){const a=rs()*6.283,e=Math.acos(rs()*.95),r=1900;sp.push(Math.sin(e)*Math.cos(a)*r,Math.cos(e)*r,Math.sin(e)*Math.sin(a)*r);}
starG.setAttribute('position',new T3.Float32BufferAttribute(sp,3));
const stars=new T3.Points(starG,new T3.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));stars.frustumCulled=false;scene.add(stars);
const seaU={t:{value:0},deep:{value:new T3.Color(0x0c5e75)},shal:{value:new T3.Color(0x2bb3a6)},skyc:{value:new T3.Color()},fogc:{value:new T3.Color()},sunc:{value:new T3.Color()},sunD:{value:new T3.Vector3()},fn:{value:120},ff:{value:1150}};
const WV='float wh(vec2 p,float t){return sin(p.x*.08+t*.9)*1.1+sin(p.y*.11-t*.7)*.9+sin((p.x+p.y)*.2+t*1.6)*.35;}';
const sea=new T3.Mesh(new T3.PlaneGeometry(3200,3200,170,170).rotateX(-Math.PI/2),new T3.ShaderMaterial({uniforms:seaU,fog:false,
vertexShader:'uniform float t;varying vec3 vW;'+WV+'void main(){vec4 w=modelMatrix*vec4(position,1.);w.y+=wh(w.xz,t);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
fragmentShader:'uniform vec3 deep,shal,skyc,fogc,sunc,sunD;uniform float t,fn,ff;varying vec3 vW;void main(){vec2 p=vW.xz;float gx=cos(p.x*.08+t*.9)*.088+cos((p.x+p.y)*.2+t*1.6)*.07;float gz=cos(p.y*.11-t*.7)*.1+cos((p.x+p.y)*.2+t*1.6)*.07;vec3 n=normalize(vec3(-gx*3.,1.,-gz*3.));vec3 V=normalize(cameraPosition-vW);float f=pow(1.-max(dot(n,V),0.),3.);vec3 c=mix(deep,shal,.3+.4*n.x+.2*sin(p.x*.02));c=mix(c,skyc,f*.85);vec3 Rr=reflect(-sunD,n);c+=sunc*pow(max(dot(Rr,V),0.),90.)*1.4;float d=length(cameraPosition-vW);c=mix(c,fogc,smoothstep(fn,ff,d));gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'}));
sea.frustumCulled=false;scene.add(sea);
/* ============ TRACK ============ */
const CP=[[0,30,10],[0,30,-130],[16,34,-270],[-30,50,-420],[-75,58,-560],[-45,63,-690],[30,62,-770],[100,64,-830],[112,60,-910],[70,54,-955],[10,47,-930],[-32,43,-990],[-20,39,-1100],[0,34,-1200],[0,33,-1300],[0,32,-1400]].map(p=>new T3.Vector3(p[0],p[1],p[2]));
const DS=2;
function mkLeg(pts){const c=new T3.CatmullRomCurve3(pts,false,'centripetal');c.arcLengthDivisions=6000;const len=c.getLength(),N=Math.floor(len/DS)+1;
 const L={len,N,P:new Float32Array(N*3),T:new Float32Array(N*3),S:new Float32Array(N*3),U:new Float32Array(N*3),KH:new Float32Array(N),KV:new Float32Array(N),BK:new Float32Array(N)};
 const v=new T3.Vector3(),t=new T3.Vector3();
 for(let i=0;i<N;i++){const u=Math.min(1,i*DS/len);c.getPointAt(u,v);c.getTangentAt(u,t);L.P[i*3]=v.x;L.P[i*3+1]=v.y;L.P[i*3+2]=v.z;L.T[i*3]=t.x;L.T[i*3+1]=t.y;L.T[i*3+2]=t.z;}
 for(let i=0;i<N-1;i++){const a=i*3,b=a+3;L.KH[i]=(L.T[a+2]*L.T[b]-L.T[a]*L.T[b+2])/DS;L.KV[i]=(L.T[b+1]-L.T[a+1])/DS;}
 L.KH[N-1]=L.KH[N-2];L.KV[N-1]=L.KV[N-2];
 for(let k=0;k<4;k++){let p=L.KH[0];for(let i=1;i<N-1;i++){const c0=L.KH[i];L.KH[i]=.25*p+.5*c0+.25*L.KH[i+1];p=c0;}}
 for(let i=0;i<N;i++){const a=i*3,tx=L.T[a],ty=L.T[a+1],tz=L.T[a+2];let sx=-tz,sz=tx;const sl=Math.hypot(sx,sz)||1;sx/=sl;sz/=sl;
  // U0 = S x T
  let Ux=0*tz-sz*ty,Uy=sz*tx-sx*tz,Uz=sx*ty-0*tx;const ul=Math.hypot(Ux,Uy,Uz)||1;Ux/=ul;Uy/=ul;Uz/=ul;
  const b=-clamp(L.KH[i]*20,-.35,.35);L.BK[i]=b;const cb=Math.cos(b),sb=Math.sin(b);
  L.S[a]=sx*cb-Ux*sb;L.S[a+1]=-Uy*sb;L.S[a+2]=sz*cb-Uz*sb;L.U[a]=Ux*cb+sx*sb;L.U[a+1]=Uy*cb;L.U[a+2]=Uz*cb+sz*sb;}
 return L;}
const legs=[mkLeg(CP),mkLeg(CP.slice().reverse())];const F=legs[0];
const cur={px:0,py:0,pz:0,tx:0,ty:0,tz:1,sx:1,sy:0,sz:0,ux:0,uy:1,uz:0,kh:0,kv:0,bk:0};
function samp(L,s,o){o=o||cur;const f=clamp(s/DS,0,L.N-1.001),i=f|0,w=f-i,a=i*3,b=a+3;
 o.px=lerp(L.P[a],L.P[b],w);o.py=lerp(L.P[a+1],L.P[b+1],w);o.pz=lerp(L.P[a+2],L.P[b+2],w);
 o.tx=lerp(L.T[a],L.T[b],w);o.ty=lerp(L.T[a+1],L.T[b+1],w);o.tz=lerp(L.T[a+2],L.T[b+2],w);
 o.sx=lerp(L.S[a],L.S[b],w);o.sy=lerp(L.S[a+1],L.S[b+1],w);o.sz=lerp(L.S[a+2],L.S[b+2],w);
 o.ux=lerp(L.U[a],L.U[b],w);o.uy=lerp(L.U[a+1],L.U[b+1],w);o.uz=lerp(L.U[a+2],L.U[b+2],w);
 o.kh=lerp(L.KH[i],L.KH[i+1],w);o.kv=lerp(L.KV[i],L.KV[i+1],w);o.bk=lerp(L.BK[i],L.BK[i+1],w);return o;}
function ribbon(L,off,y,w,h,mat){const n=L.N,pos=[],idx=[];
 for(let i=0;i<n;i++){const a=i*3,sx=L.S[a],sy=L.S[a+1],sz=L.S[a+2],ux=L.U[a],uy=L.U[a+1],uz=L.U[a+2];
  const cx=L.P[a]+sx*off+ux*y,cy=L.P[a+1]+sy*off+uy*y,cz=L.P[a+2]+sz*off+uz*y;
  [[-w/2,0],[w/2,0],[w/2,h],[-w/2,h]].forEach(d=>pos.push(cx+sx*d[0]+ux*d[1],cy+sy*d[0]+uy*d[1],cz+sz*d[0]+uz*d[1]));}
 for(let i=0;i<n-1;i++){const a=i*4,b=a+4;for(let k=0;k<4;k++){const k2=(k+1)%4;idx.push(a+k,b+k,b+k2,a+k,b+k2,a+k2);}}
 const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 const m=new T3.Mesh(g,mat);m.frustumCulled=false;scene.add(m);return m;}
const railM=toon(0x9aa3ab,{side:T3.DoubleSide}),ballM=toon(0x6d5f55,{side:T3.DoubleSide});
ribbon(F,-.75,.1,.16,.2,railM);ribbon(F,.75,.1,.16,.2,railM);ribbon(F,0,-.3,2.7,.3,ballM);
{const n=Math.floor(F.len/1.2),sl=new T3.InstancedMesh(new T3.BoxGeometry(2.4,.16,.34),toon(0x6a4630),n),m4=new T3.Matrix4(),q=new T3.Vector3(),o={};
 for(let i=0;i<n;i++){samp(F,i*1.2,o);m4.makeBasis(q.set(-o.sx,-o.sy,-o.sz),new T3.Vector3(o.ux,o.uy,o.uz),new T3.Vector3(o.tx,o.ty,o.tz));m4.setPosition(o.px+o.ux*.0,o.py+o.uy*.02,o.pz);sl.setMatrixAt(i,m4);}scene.add(sl);}
{const pts=[];for(let i=20;i<F.N-20;i+=20)pts.push(i);const cyl=new T3.InstancedMesh(new T3.CylinderGeometry(.7,1.1,1,8),toon(0x7a8590),pts.length),bm=new T3.InstancedMesh(new T3.BoxGeometry(7,.5,.8),toon(0x5d6a75),pts.length),d=new T3.Object3D();
 pts.forEach((i,k)=>{const y=F.P[i*3+1],x=F.P[i*3],z=F.P[i*3+2];d.position.set(x,(y-.6)/2-3,z);d.scale.set(1,y+5,1);d.rotation.set(0,0,0);d.updateMatrix();cyl.setMatrixAt(k,d.matrix);
  d.position.set(x,y-.5,z);d.scale.set(1,1,1);d.rotation.y=Math.atan2(F.T[i*3],F.T[i*3+2]);d.updateMatrix();bm.setMatrixAt(k,d.matrix);});scene.add(cyl,bm);}
// lamps
{const lm=toon(0x3b3a38);for(let i=15;i<F.N-10;i+=30){const x=F.P[i*3]+F.S[i*3]*2.4,y=F.P[i*3+1],z=F.P[i*3+2]+F.S[i*3+2]*2.4;bx(.12,3.2,.12,lm,x,y+1.4,z,scene);glow(lampGlow,x,y+3.2,z,3.2);}}
function signTex(l1,l2,bg){return canv(256,128,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle='#3a2a1e';g.lineWidth=8;g.strokeRect(6,6,w-12,h-12);g.fillStyle='#3a2a1e';g.textAlign='center';g.font='bold 34px sans-serif';g.fillText(l1,w/2,56);g.font='bold 44px sans-serif';g.fillText(l2,w/2,102);});}
function placeSign(sPos,side,l1,l2,bg){const o={};samp(F,sPos,o);const x=o.px+o.sx*3.6*side,z=o.pz+o.sz*3.6*side,y=o.py+2;bx(.1,4,.1,toon(0x5a4a3a),x,y-.5,z,scene);
 const p=mesh(new T3.PlaneGeometry(2.8,1.4),new T3.MeshBasicMaterial({map:signTex(l1,l2,bg),side:T3.DoubleSide}),x,y+1.6,z,scene);p.rotation.y=Math.atan2(o.tx,o.tz)+(side>0?Math.PI:0)+Math.PI;}
const advis=[];{let last=-999;for(let i=10;i<F.N-10;i++){const k=Math.abs(F.KH[i]);if(k>.011&&i*DS-last>120&&k>=Math.abs(F.KH[i-1])&&k>=Math.abs(F.KH[i+1])){last=i*DS;const v=Math.sqrt(CFG.aLat/(.6*k))*3.6,kmh=Math.max(20,Math.round(v/5)*5);advis.push([i*DS,kmh]);placeSign(Math.max(20,i*DS-110),1,'CURVE','⚠ '+kmh,'#ffd24a');placeSign(Math.min(F.len-20,i*DS+110),-1,'CURVE','⚠ '+kmh,'#ffd24a');}}}
placeSign(F.len-300,1,'MANGO TIDE','300 m','#ffe9b8');placeSign(F.len-130,1,'MANGO TIDE','130 m','#ffe9b8');placeSign(300,-1,'TERMINUS','300 m','#ffe9b8');placeSign(F.len-300,-1,'LIMIT','60','#fff');
/* ============ WORLD ============ */
const trees={blossom:[],round:[],cyp:[],fruit:[]},H={wall:[],roof:[],win:[],door:[]},rW=rng(11);
function addTree(x,y,z,s,k){trees[k].push([x,y,z,s]);}
const Wc=[0xf3e0b8,0xe8b96e,0xf0b8a0,0xfff1d6,0xe9c9a0];
function island(cx,cy,cz,r,seed,kind,nh){const R2=rng(seed);
 const rock=mesh(new T3.ConeGeometry(r,r*1.25,9,1),toon(0x8c7b6c),cx,cy-3-r*.62,cz,scene);rock.rotation.x=Math.PI;rock.rotation.y=R2()*6;
 mesh(new T3.CylinderGeometry(r*.97,r,3,18),toon(kind==='mango'?0x6fa04a:0x7bb860),cx,cy-1.5,cz,scene);
 for(let i=0;i<nh;i++){const a=R2()*6.283,d=r*(.18+.68*R2()),x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,w=4+R2()*3,h=4+R2()*4.5,dd=4+R2()*2,ys=(R2()<.35?3.5:0);
  H.wall.push([x,cy+h/2+ys,z,w,h,dd,Wc[(R2()*5)|0],a]);H.roof.push([x,cy+h+ys,z,w*1.18,2.4,dd*1.18,a]);
  H.win.push([x+Math.cos(a)*(dd/2+.05),cy+h*.62+ys,z+Math.sin(a)*(dd/2+.05),a]);H.door.push([x+Math.cos(a+1.57)*(w/2+.05),cy+1.4+ys,z+Math.sin(a+1.57)*(w/2+.05),a]);}
 const nt=kind==='mango'?18:kind==='term'?14:6+((R2()*8)|0);
 for(let i=0;i<nt;i++){const a=R2()*6.283,d=r*(.3+.62*R2());const k=kind==='mango'?(R2()<.5?'cyp':'round'):kind==='term'?'blossom':(R2()<.5?'round':'cyp');addTree(cx+Math.cos(a)*d,cy,cz+Math.sin(a)*d,.8+R2()*.7,k);}
 return rock;}
function finishScenery(){
 const d=new T3.Object3D(),mk=(geo,mat,list,fn)=>{if(!list.length)return;const im=new T3.InstancedMesh(geo,mat,list.length);list.forEach((e,i)=>{fn(e,i,im);im.setMatrixAt(i,d.matrix);});scene.add(im);return im;};
 const wcol=new T3.Color();
 mk(new T3.BoxGeometry(1,1,1),toon(0xffffff),H.wall,(e,i,im)=>{d.position.set(e[0],e[1],e[2]);d.scale.set(e[3],e[4],e[5]);d.rotation.set(0,e[7],0);d.updateMatrix();im.setColorAt(i,wcol.setHex(e[6]));});
 mk(new T3.ConeGeometry(.7071,1,4).rotateY(Math.PI/4),toon(0xc8553a),H.roof,(e,i)=>{d.position.set(e[0],e[1]+e[4]/2,e[2]);d.scale.set(e[3],e[4],e[5]);d.rotation.set(0,e[6],0);d.updateMatrix();});
 mk(new T3.PlaneGeometry(1,1.4),winMat,H.win,(e)=>{d.position.set(e[0],e[1],e[2]);d.scale.set(1,1,1);d.rotation.set(0,-e[3]+Math.PI/2,0);d.updateMatrix();});
 mk(new T3.CircleGeometry(.7,10,0,Math.PI).translate(0,-.7,0).scale(1,1.7,1),toon(0x4a2e1f,{side:T3.DoubleSide}),H.door,(e)=>{d.position.set(e[0],e[1],e[2]);d.scale.set(1,1,1);d.rotation.set(0,-e[3]+Math.PI,0);d.updateMatrix();});
 const tr=(list,geoA,matA,geoB,matB,yB)=>{mk(geoA,matA,list,(e)=>{d.position.set(e[0],e[1]+yB,e[2]);d.scale.set(e[3],e[3],e[3]);d.rotation.set(0,0,0);d.updateMatrix();});};
 tr(trees.round,new T3.IcosahedronGeometry(2,1),toon(0x4f8a3a),0,0,4.2);tr(trees.blossom,new T3.IcosahedronGeometry(2.1,1),toon(0xf5a8c0),0,0,4.4);tr(trees.cyp,new T3.ConeGeometry(.9,6.5,7),toon(0x2f5f3a),0,0,3.5);
 const trunkL=trees.round.concat(trees.blossom);mk(new T3.CylinderGeometry(.25,.4,3,6),toon(0x6a4630),trunkL,(e)=>{d.position.set(e[0],e[1]+1.5*e[3],e[2]);d.scale.set(e[3],e[3],e[3]);d.rotation.set(0,0,0);d.updateMatrix();});
 const fr=[];trees.round.forEach(e=>{for(let k=0;k<4;k++)fr.push([e[0]+(rW()-.5)*3*e[3],e[1]+4.2*e[3]+(rW()-.4)*2.5,e[2]+(rW()-.5)*3*e[3],e[3]]);});
 mk(new T3.SphereGeometry(.28,6,5),toon(0xff8a1a),fr,(e)=>{d.position.set(e[0],e[1],e[2]);d.scale.set(1,1,1);d.rotation.set(0,0,0);d.updateMatrix();});}
// stations
const gSp=new T3.Group();scene.add(gSp);
const person=(p,col,hat)=>{const g=new T3.Group();const body=bx(.5,.7,.35,toon(col),0,.7,0,g);const head=mesh(new T3.SphereGeometry(.2,10,8),toon(0xf0c8a0),0,1.2,0,g);const arm=bx(.12,.5,.12,toon(col),.32,.8,0,g);arm.geometry.translate(0,.2,0);
 if(hat)mesh(new T3.ConeGeometry(.22,.3,8),toon(hat),0,1.42,0,g);const legs=bx(.4,.45,.28,toon(0x4a4a5a),0,.22,0,g);g.userData={head,arm,body,legs};if(p)p.add(g);return g;};
const crowd=[];
function station(sPos,name,kind){const o={};samp(F,sPos,o);const g=new T3.Group();g.position.set(o.px,o.py,o.pz);const m=new T3.Matrix4();m.makeBasis(new T3.Vector3(-o.sx,-o.sy,-o.sz),new T3.Vector3(o.ux,o.uy,o.uz),new T3.Vector3(o.tx,o.ty,o.tz));g.quaternion.setFromRotationMatrix(m);scene.add(g);
 const pm=toon(0xd9c7a0),wood=toon(0x7a4f32),creamM=toon(0xf6e8c8),terr=toon(0xc8553a),brass=toon(0xc9964a);
 [1,-1].forEach(sd=>{const p=bx(4.6,2.4,46,pm,sd*3.9,-.9,0,g);p.receiveShadow=true;bx(4.6,.15,.4,toon(0xffd24a),sd*3.9,.32,0,g).scale.z=1;});
 bx(4.6,.05,.5,toon(0xffd24a),3.9,.34,0,g);
 const house=bx(5.5,3.6,13,creamM,6.2,2.1,-6,g);mesh(new T3.ConeGeometry(.7071,1,4).rotateY(Math.PI/4),terr,6.2,5.9,-6,g).scale.set(7,2.4,14.6);
 for(let i=0;i<4;i++)bx(.1,1.2,1.4,wMatSt,3.42,2.4,-10+i*3,g);
 bx(2.6,10,2.6,creamM,6,5,8,g);mesh(new T3.ConeGeometry(2.1,2.6,4).rotateY(Math.PI/4),terr,6,11.3,8,g);
 const clk=mesh(new T3.CircleGeometry(.95,24),new T3.MeshBasicMaterial({map:canv(128,128,(c,w)=>{c.fillStyle='#fff6dc';c.fillRect(0,0,w,w);c.strokeStyle='#3a2a1e';c.lineWidth=6;c.beginPath();c.arc(64,64,58,0,7);c.stroke();c.lineWidth=7;c.beginPath();c.moveTo(64,64);c.lineTo(64,28);c.moveTo(64,64);c.lineTo(88,74);c.stroke();})}),3.65,8.6,8,g);clk.rotation.y=-Math.PI/2;
 const bunt=[0xff7a59,0xffd24a,0x3bb3a6,0xf5a8c0];for(let i=0;i<14;i++){const x=i/13,b=bx(.3,.4,.05,toon(bunt[i%4]),3.5+x*5.4,4.6-Math.sin(x*3.14)*.6,2.1,g);b.rotation.z=Math.sin(i)*.2;}
 for(let i=-1;i<=1;i+=2)for(let k=0;k<2;k++){const lx=1.6*(i),lz=-14+k*22;bx(.12,3.4,.12,toon(0x3b3a38),i*2.0+(i>0?3.2:-3.2),1.9,lz,g);const w=glow(lampGlow,i*2.0+(i>0?3.2:-3.2),3.8,lz,3.4,g);}
 for(let i=0;i<9;i++){const c=person(g,[0xd7664a,0x3f7fb3,0xe0b04a,0x7a5aa0,0x4a9a6a][i%5],i%2?0xb88a4a:0);c.position.set((i%2?1:-1)*(3+rW()*1.5),.3,-18+i*3.6+rW());c.scale.setScalar(.9+rW()*.25);c.rotation.y=(i%2?-1:1)*1.57;crowd.push(c);}
 if(kind==='term'){const pls=new T3.InstancedMesh(new T3.SphereGeometry(.35,6,5),toon(0xffffff),140),d=new T3.Object3D(),cl=[0xf5a8c0,0xffffff,0xffd24a,0xe06a8a],cc=new T3.Color();for(let i=0;i<140;i++){const a=rW()*6.283,r=7+rW()*28;d.position.set(o.px+Math.cos(a)*r,o.py-1.2+rW()*.3,o.pz-10+Math.sin(a)*r-20);d.scale.setScalar(1);d.updateMatrix();pls.setMatrixAt(i,d.matrix);pls.setColorAt(i,cc.setHex(cl[i%4]));}scene.add(pls);}
 return g;}
const winMat=new T3.MeshBasicMaterial({color:0x2a2a3a,side:T3.DoubleSide}),wMatSt=winMat;
const stA=station(CFG.stop,'Spring Terminus','term'),stB=station(F.len-CFG.stop,'Mango Tide','mango');
const oS={},oE={};samp(F,CFG.stop,oS);samp(F,F.len-CFG.stop,oE);
island(oS.px,oS.py-1.0,oS.pz-20,42,5,'term',3);island(oE.px+4,oE.py-1.0,oE.pz-14,50,9,'mango',34);
// lighthouse + boats + harbor
{const lx=oE.px-38,lz=oE.pz-26,ly=oE.py-1;mesh(new T3.CylinderGeometry(1.4,2.2,14,10),toon(0xfff1d6),lx,ly+7,lz,scene);mesh(new T3.CylinderGeometry(1.7,1.9,2,10),toon(0xd8483a),lx,ly+7,lz,scene);mesh(new T3.CylinderGeometry(1.8,1.8,.5,10),toon(0x3a2a1e),lx,ly+14.2,lz,scene);const lm=mesh(new T3.SphereGeometry(1.1,10,8),new T3.MeshBasicMaterial({color:0xffe08a}),lx,ly+15.2,lz,scene);glow(lampGlow,lx,ly+15.4,lz,16);mesh(new T3.ConeGeometry(1.5,1.6,10),toon(0xd8483a),lx,ly+16.8,lz,scene);}
const boats=[];for(let i=0;i<6;i++){const b=new T3.Group(),a=i*1.1;bx(3,.8,8,toon(i%2?0xf3e0b8:0xd8483a),0,.2,0,b);const sl=mesh(new T3.ConeGeometry(2.2,6,3),toon(0xfff6dc),0,4,0,b);sl.scale.z=.1;b.position.set(oE.px+Math.cos(a)*(60+i*9),.3,oE.pz-14+Math.sin(a)*(60+i*9));b.rotation.y=a;scene.add(b);boats.push(b);}
// ambient islands + workshop
const rI=rng(23),falls=[];[.1,.17,.25,.32,.4,.58,.66,.74,.83,.9].forEach((u,i)=>{const o={};samp(F,u*F.len,o);const sd=i%2?1:-1,off=(55+rI()*60)*sd,r=10+rI()*12;const x=o.px+o.sx*off,y=o.py+(rI()-.6)*22,z=o.pz+o.sz*off;island(x,y,z,r,31+i,'sm',rI()<.4?3:0);
 const w=mesh(new T3.CylinderGeometry(.9,1.2,y+8,6,1,true),new T3.MeshBasicMaterial({color:0xdff6ff,transparent:true,opacity:.45,side:T3.DoubleSide,depthWrite:false}),x+sd*0,(y-3)/2-4,z+r*.8,scene);});
const oW={};samp(F,F.len*.5,oW);const wx=oW.px+oW.sx*70,wy=oW.py-6,wz=oW.pz+oW.sz*70;island(wx,wy,wz,20,77,'sm',0);
{const g=new T3.Group();g.position.set(wx,wy,wz);scene.add(g);bx(8,5,7,toon(0xe8b96e),-4,2.5,2,g);mesh(new T3.ConeGeometry(6,3,4).rotateY(Math.PI/4),toon(0xc8553a),-4,6.5,2,g);bx(1.6,9,1.6,toon(0x9a4a3a),-8,5,-2,g);
 const crane=bx(.6,12,.6,toon(0xc58f3f),5,6,-3,g),arm=bx(11,.5,.5,toon(0xc58f3f),1,12,-3,g);bx(.1,5,.1,toon(0x333),-3.5,9.5,-3,g);
 const gear=mesh(new T3.CylinderGeometry(2.4,2.4,.5,10).rotateX(Math.PI/2),toon(0xc9964a),6,3,4,g);for(let i=0;i<8;i++){const a=i*.785;const t=bx(.7,.8,.5,toon(0xc9964a),Math.cos(a)*2.6,Math.sin(a)*2.6,0,gear);t.rotation.z=a;}
 const tb=mesh(new T3.PlaneGeometry(6,1.6),new T3.MeshBasicMaterial({map:canv(384,96,(c,w,h)=>{c.fillStyle='#7a4f32';c.fillRect(0,0,w,h);c.strokeStyle='#c9964a';c.lineWidth=6;c.strokeRect(5,5,w-10,h-10);c.fillStyle='#fff3dc';c.font='bold 40px sans-serif';c.textAlign='center';c.fillText('Oliver Cloudworks',w/2,62);}),side:T3.DoubleSide}),-4,9.2,6,g);
 const ol=person(g,0x3f7fb3,0x8a4a2a);ol.position.set(1,0,5);ol.scale.setScalar(1.3);mesh(new T3.ConeGeometry(.2,.45,8),toon(0x6a4630),0,1.0,.15,ol).rotation.x=2.7;
 W_={gear,oliver:ol,steam:[0,1,2].map(i=>glow(glowMat(0xffffff),-8,11+i*2,-2,2.5,g))};}
var W_;
// orbit ring
const ringS=.42*F.len,ringO={};samp(F,ringS,ringO);const ringG=new T3.Group();ringG.position.set(ringO.px,ringO.py,ringO.pz);ringG.lookAt(ringO.px+ringO.tx,ringO.py+ringO.ty,ringO.pz+ringO.tz);scene.add(ringG);
const ring=mesh(new T3.TorusGeometry(15,.9,12,48),toon(0xb5ab95,{emissive:0x3a2a10}),0,0,0,ringG);for(let i=0;i<12;i++){const a=i*.5236;const s=glow(glowMat(0x7af0e0),Math.cos(a)*15,Math.sin(a)*15,0,3,ring);}
const rinG2=mesh(new T3.TorusGeometry(15,.25,8,48),new T3.MeshBasicMaterial({color:0x7af0e0}),0,0,0,ringG);
// clouds
const cloudTex=canv(128,128,g=>{for(let i=0;i<14;i++){const x=24+Math.random()*80,y=50+Math.random()*34,r=18+Math.random()*22,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);}});
const cloudMat=new T3.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,opacity:.9,fog:true});const clouds=[],rC=rng(5);
for(let i=0;i<90;i++){const o={};samp(F,rC()*F.len,o);const low=i<40,sp=new T3.Sprite(cloudMat),sc=low?120+rC()*140:50+rC()*70;sp.scale.set(sc,sc*.5,1);sp.position.set(o.px+(rC()-.5)*700,low?8+rC()*14:o.py+(rC()-.4)*70,o.pz+(rC()-.5)*200);scene.add(sp);clouds.push(sp);}
// balloons, whale
const balloons=[];[[.2,-1],[.52,1],[.78,-1]].forEach((b,i)=>{const o={};samp(F,b[0]*F.len,o);const g=new T3.Group();mesh(new T3.SphereGeometry(6,12,10),toon([0xe8603a,0xf0b84a,0x3bb3a6][i]),0,0,0,g).scale.y=1.2;bx(1.6,1.2,1.6,toon(0x7a4f32),0,-9,0,g);g.position.set(o.px+o.sx*95*b[1],o.py+36,o.pz+o.sz*95*b[1]);scene.add(g);balloons.push(g);});
const whale=new T3.Group();mesh(new T3.SphereGeometry(30,10,8),toon(0x3a4a68),0,0,0,whale).scale.set(1,.5,2.6);const tail=mesh(new T3.ConeGeometry(14,40,4),toon(0x3a4a68),0,6,-80,whale);tail.rotation.x=-1.4;whale.position.set(-380,150,-700);scene.add(whale);
finishScenery();
/* ============ TRAM MODEL ============ */
const tram=new T3.Group(),body=new T3.Group();tram.add(body);scene.add(tram);
const ironM=toon(0x5d6168),paintM=toon(0xf4e7c8),roofM=toon(0xd6c9a8),brassM=toon(0xc9964a),woodM=toon(0x8a5a36),outM=new T3.MeshBasicMaterial({color:0x2b1d17,side:T3.BackSide});
bx(3.5,.9,14.2,ironM,0,.95,0,body);
const rr=(w,h,r)=>{const s=new T3.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;};
const upG=new T3.ExtrudeGeometry(rr(3.2,2.5,.5),{depth:13.4,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:3,curveSegments:6});upG.center();
const upper=mesh(upG,paintM,0,2.65,0,body);upper.castShadow=true;const outl=mesh(upG,outM,0,2.65,0,body);outl.scale.set(1.04,1.04,1.02);
const roofT=mesh(new T3.CylinderGeometry(1.6,1.75,13.6,14).rotateX(Math.PI/2),roofM,0,3.9,0,body);roofT.scale.y=.4;roofT.castShadow=true;
const twinM=new T3.MeshBasicMaterial({color:0x9cd6df,transparent:true,opacity:.6,depthWrite:false,side:T3.DoubleSide});
[1,-1].forEach(sd=>{[-5.3,-3.3,3.3,5.3].forEach(z=>{const w=mesh(new T3.PlaneGeometry(1.5,1),twinM,sd*1.72,2.95,z,body);w.rotation.y=sd*Math.PI/2;bx(.06,1.1,1.6,brassM,sd*1.72,2.95,z,body);});
 bx(.08,.14,13.8,brassM,sd*1.74,1.55,0,body);bx(.08,.14,13.8,brassM,sd*1.74,3.85,0,body);});
const doors=[];[1,-1].forEach(sd=>[-1,1].forEach(dz=>{const d=bx(.1,2.1,1.1,woodM,sd*1.75,2.45,dz*.6,body);d.userData={sd,dz,z0:dz*.6};doors.push(d);}));
const lamp=mesh(new T3.SphereGeometry(.38,12,10),new T3.MeshBasicMaterial({color:0xfff0b0}),0,1.9,7.2,body);glow(lampGlow,0,1.9,7.4,5,body);glow(lampGlow,0,2.0,-7.4,2.4,body);
bx(3,.2,.5,brassM,0,1.2,7.2,body);const frontW=mesh(new T3.PlaneGeometry(2.2,1),twinM,0,2.95,6.93,body);
const wheels=[];[-4.6,4.6].forEach(z=>{bx(3,.3,2.4,ironM,0,.45,z,body);[-1,1].forEach(sd=>[-.8,.8].forEach(dz=>{const w=mesh(new T3.CylinderGeometry(.5,.5,.25,14).rotateZ(Math.PI/2),toon(0x2e3136),sd*1.3,.5,z+dz,body);bx(.3,.9,.08,brassM,0,0,0,w);w.castShadow=true;wheels.push(w);}));});
bx(.3,.3,1.2,ironM,0,.8,7.5,body);bx(.3,.3,1.2,ironM,0,.8,-7.5,body);
// roof racks & upgrades
const rack1=new T3.Group();rack1.position.y=4.4;body.add(rack1);[-1,1].forEach(sx=>{bx(.06,.5,6,brassM,sx*1.1,.25,0,rack1);});bx(2.3,.06,6,brassM,0,.5,0,rack1);
[[0x8a4a2a,-2],[0x3f6a8a,-.6],[0x9a7a3a,.9],[0x6a3a5a,2.2]].forEach(a=>{const s=bx(.9,.55,.7,toon(a[0]),(a[1]%2?.3:-.3),.8,a[1],rack1);s.rotation.y=a[1]*.2;});
const rack2=new T3.Group();rack2.position.set(0,4.4,0);body.add(rack2);bx(2.3,.06,3,brassM,0,.5,-5.1,rack2);bx(2.3,.06,3,brassM,0,.5,5.1,rack2);[-1,1].forEach(sx=>[-5.1,5.1].forEach(z=>bx(.06,.5,3,brassM,sx*1.1,.25,z,rack2)));
bx(.9,.6,.8,toon(0xb35a3a),0,.85,5,rack2);bx(1,.5,.8,toon(0x4a7a5a),.2,.8,-5.2,rack2);rack2.visible=false;
const lanterns=new T3.Group();body.add(lanterns);const lanternMs=[];for(let i=0;i<6;i++){const g=new T3.Group(),sd=i%2?1:-1;g.position.set(sd*1.65,3.8,-5+Math.floor(i/2)*5);bx(.02,.7,.02,ironM,0,-.35,0,g);const l=mesh(new T3.SphereGeometry(.2,8,6),new T3.MeshBasicMaterial({color:0xffc860}),0,-.8,0,g);glow(lampGlow,0,-.8,0,1.8,g);lanterns.add(g);lanternMs.push(g);}lanterns.visible=false;
const vinePts=[];for(let i=0;i<=24;i++){const u=i/24;vinePts.push(new T3.Vector3(Math.sin(u*14)*1.1,4.45+Math.sin(u*9)*.15,-6.5+u*13));}
const vineG=new T3.TubeGeometry(new T3.CatmullRomCurve3(vinePts),90,.07,5),vine=new T3.Mesh(vineG,toon(0x4f8a3c));body.add(vine);vine.visible=false;
const leaves=[];for(let i=0;i<22;i++){const p=vinePts[(i*1.09)|0],l=mesh(new T3.SphereGeometry(.2,6,5),toon(0x6fb04a),p.x,p.y+.08,p.z,body);l.scale.set(1,.3,1.5);l.visible=false;leaves.push(l);}
let vineGrow=0,vineTarget=0;vineG.setDrawRange(0,0);
// interior
bx(3,.15,13.2,toon(0x6a4a30),0,1.42,0,body);
[-1,1].forEach(sd=>bx(.6,.45,13,woodM,sd*1.2,1.7,0,body));
const straps=[];[-1,1].forEach(sd=>[-4.5,-1.5,1.5,4.5].forEach(z=>{const g=new T3.Group();g.position.set(sd*.5,3.7,z);bx(.03,.9,.03,toon(0x5a3a22),0,-.45,0,g);mesh(new T3.TorusGeometry(.1,.025,5,10),brassM,0,-.95,0,g);body.add(g);straps.push(g);}));
cabin.position.set(0,3,0);body.add(cabin);
// passengers
const pax=[],rP=rng(99);const cols=[0xd7664a,0x3f7fb3,0xe0b04a,0x7a5aa0,0x4a9a6a,0xe08aa0,0x5a7a8a,0xb06a3a];
for(let i=0;i<20;i++){const seated=i<16,p=person(body,cols[(rP()*8)|0],rP()<.4?[0xb88a4a,0x4a3a5a,0x9a3a3a][i%3]:0);const sd=i%2?1:-1,k=(i>>1);
 if(seated){p.position.set(sd*1.2,1.7,-5.6+(k%8)*1.6);p.userData.legs.visible=false;p.rotation.y=sd>0?-1.57:1.57;p.scale.setScalar(.7+rP()*.2);}
 else{p.position.set(((i-16)%2?.4:-.4),1.5,-2.2+((i-16)>>1)*4.4);p.scale.setScalar(.72+rP()*.15);p.rotation.y=rP()*6;}
 p.userData.seated=seated;p.userData.ph=rP()*6;p.visible=false;pax.push(p);}
let paxShown=0;
function applyUpg(){const u=SV.up;const k=(u.plate|0)?1:0;ironM.color.setHex(k?0x4a7a3a:0x5d6168);paintM.color.setHex(k?0xe8efd0:0xf4e7c8);roofM.color.setHex(k?0x6a9a4a:0xd6c9a8);rack2.visible=!!(u.rack|0);lanterns.visible=vine.visible=!!(u.lant|0);leaves.forEach(l=>l.visible=!!(u.lant|0));vineTarget=(u.lant|0)?1:0;}
/* ============ INPUT ============ */
const inp={brake:0,boost:0,lean:0},keys={};
function recalc(){inp.brake=(keys[' ']||keys.mb||keys.tb)?1:0;inp.boost=(keys.w||keys.arrowup||keys.tg)?1:0;inp.lean=((keys.d||keys.arrowright||keys.tr)?1:0)-((keys.a||keys.arrowleft||keys.tl)?1:0);}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(e.repeat){if([' ','arrowup','arrowdown'].includes(k))e.preventDefault();return;}keys[k]=1;recalc();AU.init();
 if(k===' '||k.startsWith('arrow'))e.preventDefault();if(k==='p'||k==='escape')togglePause();if(k==='c')camMode=(camMode+1)%3;if(k==='m')toggleMute();if(k==='h')$('help').classList.toggle('on');});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0;recalc();});
function hold(id,key){const el=$(id);const on=e=>{e.preventDefault();keys[key]=1;el.classList.add('on');recalc();AU.init();},off=e=>{keys[key]=0;el.classList.remove('on');recalc();};el.addEventListener('pointerdown',on);['pointerup','pointercancel','pointerleave'].forEach(n=>el.addEventListener(n,off));}
hold('tBrake','tb');hold('tGo','tg');hold('tL','tl');hold('tR','tr');
$('c').addEventListener('pointerdown',e=>{keys.mb=1;recalc();AU.init();});addEventListener('pointerup',()=>{keys.mb=0;recalc();});
document.addEventListener('contextmenu',e=>e.preventDefault());
/* ============ AUDIO ============ */
const AU={x:null,
 init(){if(this.x){if(this.x.state==='suspended')this.x.resume();return;}try{const X=this.x=new(window.AudioContext||window.webkitAudioContext)();this.mg=X.createGain();this.sg=X.createGain();this.mu=X.createGain();this.sg.connect(this.mg);this.mu.connect(this.mg);this.mg.connect(X.destination);
  const d0=X.createBuffer(1,X.sampleRate*2,X.sampleRate),d=d0.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nb=d0;
  const lp=(type,f,q)=>{const s=X.createBufferSource();s.buffer=d0;s.loop=true;const fl=X.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q||1;const g=X.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(this.sg);s.start();return{g,fl};};
  this.wind=lp('bandpass',500,.6);this.rain=lp('highpass',3500);
  this.hum=X.createOscillator();this.hum.type='sawtooth';this.hum.frequency.value=40;const hl=X.createBiquadFilter();hl.type='lowpass';hl.frequency.value=180;this.hg=X.createGain();this.hg.gain.value=0;this.hum.connect(hl);hl.connect(this.hg);this.hg.connect(this.sg);this.hum.start();
  this.sq=X.createOscillator();this.sq.type='square';this.sq.frequency.value=1700;this.sqg=X.createGain();this.sqg.gain.value=0;this.sq.connect(this.sqg);this.sqg.connect(this.sg);this.sq.start();
  this.vol();this.mt=setInterval(()=>this.note(),650);}catch(e){this.x=null;}},
 vol(){if(!this.x)return;const s=SV.set;this.mg.gain.value=muted?0:s.vol;this.sg.gain.value=s.sfx;this.mu.gain.value=s.music*.55;},
 tone(f,dur,type,vol,dest,dl){if(!this.x)return;const X=this.x,o=X.createOscillator(),g=X.createGain(),t=X.currentTime+(dl||0);o.type=type||'sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dest||this.sg);o.start(t);o.stop(t+dur+.05);},
 puff(dur,f,vol){if(!this.x)return;const X=this.x,s=X.createBufferSource(),fl=X.createBiquadFilter(),g=X.createGain();s.buffer=this.nb;fl.type='bandpass';fl.frequency.value=f;g.gain.value=vol;g.gain.exponentialRampToValueAtTime(.0001,X.currentTime+dur);s.connect(fl);fl.connect(g);g.connect(this.sg);s.start(0,Math.random());s.stop(X.currentTime+dur);},
 clack(v){this.puff(.07,900+v*30,.18+v*.01);},click(){this.tone(880,.08,'triangle',.12);},chime(){[523,659,784].forEach((f,i)=>this.tone(f,1.2,'sine',.12,0,i*.12));},coin(){this.tone(1318,.12,'square',.05);this.tone(1760,.25,'square',.05,0,.08);},hiss(){this.puff(.7,4000,.12);},thunder(){this.puff(2,120,.5);},
 note(){if(!this.x||paused)return;const sc=[0,2,4,7,9,12,14,16],base=TOD.night>.5?196:261.6,f=base*Math.pow(2,sc[(Math.random()*8)|0]/12);this.tone(f,2.4,'triangle',.07,this.mu);if(Math.random()<.35)this.tone(base/2*Math.pow(2,sc[(Math.random()*4)|0]/12),4,'sine',.07,this.mu);},
 update(v,br,rain){if(!this.x)return;const t=this.x.currentTime;this.wind.g.gain.setTargetAtTime(.03+v/24*.3,t,.1);this.wind.fl.frequency.setTargetAtTime(300+v*45,t,.1);this.hum.frequency.setTargetAtTime(30+v*4,t,.1);this.hg.gain.setTargetAtTime(Math.min(.14,v/20*.14),t,.1);this.sqg.gain.setTargetAtTime(br>.5&&v>1&&v<10?.012*br:0,t,.05);this.sq.frequency.setTargetAtTime(1400+(10-v)*40,t,.1);this.rain.g.gain.setTargetAtTime(rain*.12,t,.3);}};
function toggleMute(){muted=!muted;$('bMute').textContent=muted?'🔇':'🔊';AU.vol();}
/* ============ UI HELPERS ============ */
let subT=0;function sub(txt){if(!SV.set.subs)return;const e=$('sub');e.textContent=txt;e.style.display='block';subT=2.6;}
let toastT=0;function toast(txt,bad){const e=$('toast');e.textContent=txt;e.className='show'+(bad?' bad':'');toastT=1.8;}
function floatTxt(txt,x,y){const e=document.createElement('div');e.className='fl';e.textContent=txt;e.style.left=(x||innerWidth/2-30)+'px';e.style.top=(y||innerHeight*.35)+'px';document.body.appendChild(e);setTimeout(()=>e.remove(),1700);}
function coinBurst(n){if(SV.set.rm)n=Math.min(n,4);for(let i=0;i<n;i++){const e=document.createElement('div');e.className='coin';e.style.left=innerWidth/2+'px';e.style.top=innerHeight*.38+'px';e.style.setProperty('--dx',(Math.random()-.5)*300+'px');e.style.setProperty('--dy',(-60-Math.random()*160)+'px');document.body.appendChild(e);setTimeout(()=>e.remove(),1000);}AU.coin();}
const bub=$('bub');let bubT=0,bubP=null;const tmpV=new T3.Vector3();
function say(txt){const cand=pax.filter(p=>p.visible);if(!cand.length)return;bubP=cand[(Math.random()*cand.length)|0];bub.textContent=txt;bub.style.display='block';bubT=2.4;}
function cps(){let h='';[.25,.5,.75].forEach(f=>{const p=$('route').getPointAtLength(f*$('route').getTotalLength());h+=`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#fff6e2" stroke="#a77d38" stroke-width="2"/>`;});$('cps').innerHTML=h;}
/* ============ GAME STATE ============ */
const S={st:'TITLE',leg:0,loop:0,s:CFG.stop,ps:CFG.stop,v:0,aS:0,jS:0,brk:0,thr:0,heat:0,comfort:100,smoothT:0,streak:0,tips:SV.tips,paxN:0,paxT:0,tipsLeg:0,cSum:0,cN:0,perfect:0,bestStreak:0,slam:false,t:0,stT:0,rain:0,flash:0,windT:0,steadyT:0,steadyCD:0,lowFlag:false,jointI:0,ringDone:-1,bridgeIn:false,bridgeBad:false,gust:0,err:0,lean:0,phase:0,timeScale:1,tsT:0,doorOpen:0,bumpV:0,shake:0,pitch:0,pitchV:0,roll:0,rollV:0,bounce:0,bounceV:0,plateT:0,vsafe:99,kA:0};
let paused=false,pausedFrom=null,camMode=0,quality=1,autoQ=true;
const TOD={night:0,d:1,e:1};
const sunDir=new T3.Vector3(),cT=new T3.Color(),cH=new T3.Color(),tmpC=new T3.Color(),cS=CFG.sky;
const cDT=new T3.Color(cS.dayTop),cDH=new T3.Color(cS.dayHor),cNT=new T3.Color(cS.nightTop),cNH=new T3.Color(cS.nightHor),cW=new T3.Color(cS.warm),cV=new T3.Color(cS.violet),cG=new T3.Color(0x7d8a96),cWin=new T3.Color(),cDark=new T3.Color(0x2a2a3a),cLit=new T3.Color(0xffd36a),cTD=new T3.Color(0x9cd6df),cTL=new T3.Color(0xffd890);
const maxPax=()=>CFG.paxCap+4*(SV.up.rack|0),legStop=l=>legs[l].len-CFG.stop;
const upv=k=>SV.up[k]|0;
function zones(leg){const L=legs[leg].len,a=.6*F.len,b=.78*F.len;return leg===0?[a,b,ringS]:[L-b,L-a,L-ringS];}
function zoneLimit(s,leg){const L=legs[leg].len,stop=L-CFG.stop;let lim=CFG.vmax*(1+.06*upv('boost'));if(s<CFG.stop+44)lim=Math.min(lim,8);const d=stop-s;if(d<320)lim=Math.min(lim,5+Math.max(0,d)*.062);return lim;}
function tod(){const ph=S.phase,th=ph<.55?ph/.55*Math.PI:Math.PI+(ph-.55)/.45*Math.PI;const e=Math.sin(th);sunDir.set(Math.cos(th)*.9,e,-.4).normalize();TOD.e=sunDir.y;TOD.d=sstep(-.12,.45,TOD.e);TOD.night=1-sstep(-.18,.12,TOD.e);
 const w=Math.exp(-Math.pow((TOD.e-.02)/.2,2)),rain=S.rain;cT.copy(cNT).lerp(cDT,TOD.d).lerp(cV,w*.35);cH.copy(cNH).lerp(cDH,TOD.d).lerp(cW,w*.85);if(rain>0){cT.lerp(cG,rain*.55);cH.lerp(cG,rain*.6);}
 skyM.uniforms.top.value.copy(cT);skyM.uniforms.hor.value.copy(cH);skyM.uniforms.sd.value.copy(sunDir);skyM.uniforms.sc.value.setRGB(1,.85+.1*w,.6+.2*(1-w)).multiplyScalar(1-rain*.7);
 scene.fog.color.copy(cH);seaU.fogc.value.copy(cH);seaU.skyc.value.copy(cH).lerp(cT,.4);seaU.sunD.value.copy(sunDir).y=Math.max(.05,sunDir.y);seaU.sunD.value.normalize();seaU.sunc.value.setRGB(1,.8,.55).multiplyScalar(TOD.d*(1-rain));
 const day=TOD.e>-.02;tmpC.setRGB(1,.94-.2*w,.82-.35*w).lerp(cNT.setHex(0x6a86c8),day?0:1);cNT.setHex(cS.nightTop);sunL.color.copy(tmpC);sunL.intensity=(.35+1.2*TOD.d)*(1-rain*.5);hemi.color.copy(cH).lerp(cT,.5);hemi.intensity=.45+.5*TOD.d+S.flash*2;
 stars.material.opacity=TOD.night*.9*(1-rain);cloudMat.color.setRGB(1,1,1).lerp(cW,w*.4).multiplyScalar(.35+.65*TOD.d).lerp(cG,rain*.5);cloudMat.color.multiplyScalar(1);
 cWin.copy(cDark).lerp(cLit,TOD.night);winMat.color.copy(cWin);twinM.color.copy(cTD).lerp(cTL,TOD.night);twinM.opacity=.6+.3*TOD.night;lampGlow.opacity=.2+.8*TOD.night;cabin.intensity=TOD.night*1.2;}
function hudSet(){const dst=S.leg===0?'To Mango Tide Island':'To Spring Terminus';if($('dest').textContent!==dst){$('dest').textContent=dst;$('sA').textContent=S.leg?'Mango Tide':'Spring Terminus';$('sB').textContent=S.leg?'Spring Terminus':'Mango Tide';}}
function mult(){return 1+Math.min(2,S.streak*.25);}
function addTips(n,lbl){n=Math.round(n*mult());S.tips+=n;S.tipsLeg+=n;SV.tips=S.tips;floatTxt('+'+n+(lbl?' '+lbl:''));coinBurst(Math.min(24,6+n/5|0));}
/* state machine */
const ST={
 TITLE:{enter(){$('title').classList.add('on');$('hud').style.visibility='hidden';$('best').textContent=SV.best;},update(dt){}},
 BOARDING:{enter(){$('title').classList.remove('on');$('hud').style.visibility='visible';S.paxT=0;S.doorOpen=1;sub('All aboard!');AU.chime();S.paxN=0;S.stT=0;},update(dt){S.stT+=dt;const target=Math.min(maxPax(),CFG.pax0+S.loop*2+(S.leg?1:0)),k=Math.min(target,Math.floor(S.stT/.25));S.paxN=Math.max(S.paxN,k);if(S.stT>3.4){S.paxN=target;setS('RUNNING');sub('Next stop: '+(S.leg?'Spring Terminus':'the clouds!'));S.doorOpen=0;AU.hiss();}}},
 RUNNING:{enter(){S.ringDone=-1;S.cSum=0;S.cN=0;S.tipsLeg=0;},update(dt){}},
 DOCKING:{enter(){S.stT=0;S.stage=0;},update(dt){S.stT+=dt;const t=S.stT;
  if(S.stage===0&&t>1){S.stage=1;S.doorOpen=1;AU.hiss();sub('Doors opening - '+(S.leg?'Spring Terminus':'Mango Tide'));AU.chime();}
  if(S.stage===1&&t>1.8){S.stage=2;sub('Welcome to '+(S.leg?'Spring Terminus':'Mango Tide')+'!');}
  if(S.stage>=1&&t<4.5){const n=Math.max(0,Math.round(S.paxN*(1-(t-1)/2.6)));S.paxN=t<3.6?n:S.paxN;if(t>3.6)S.paxN=Math.min(maxPax(),Math.max(S.paxN,Math.floor((t-3.6)*9)));}
  if(S.stage===2&&t>4.7){S.stage=3;sub('Doors closing');S.doorOpen=0;AU.hiss();}
  if(S.stage===3&&t>5.8){S.stage=4;showSum();}}},
 SUMMARY:{enter(){},update(){}},
 WORKSHOP:{enter(){buildShop();$('shop').classList.add('on');$('hud').style.visibility='hidden';},update(dt){if(vineGrow<vineTarget)vineGrow=Math.min(vineTarget,vineGrow+dt*.45);if(shopT>0){shopT-=dt;$('vine').firstChild.style.width=(100-shopT/2.4*100)+'%';if(shopT<=0){$('vtxt').textContent='"She\'s all yours!" — Oliver';$('oli').textContent='"She\'s all yours!"';sub("She's all yours!");}}}},
 PAUSED:{enter(){},update(){}}};
function setS(n){S.st=n;if(ST[n].enter)ST[n].enter();}
function showSum(){setS('SUMMARY');const avg=S.cN?Math.round(S.cSum/S.cN):Math.round(S.comfort);const stars=S.slam?1:1+(avg>=60)+(S.lastPrec<=4)+(avg>=85&&S.lastPrec<=CFG.perfect);$('sumT').textContent=(S.leg?'Back at Spring Terminus':'Welcome to Mango Tide!')+' '+'★'.repeat(stars)+'☆'.repeat(4-stars);$('sumQ').textContent=S.slam?'A bumpy stop. Brake earlier and softer next time.':(S.lastPrec<=CFG.perfect?'Dead on the marker. Smooth as butter!':'Nice and smooth.');$('sTips').textContent=S.tipsLeg;$('sCom').textContent=avg;$('sPerf').textContent=S.perfect;$('sStr').textContent=S.bestStreak;SV.best=Math.max(SV.best,S.tipsLeg);save();$('bCont').textContent=S.leg?'Next loop':'Visit Oliver\'s Cloudworks';$('sum').classList.add('on');$('hud').style.visibility='hidden';}
function dock(slam){S.v=0;S.slam=slam;const gap=S.s-legStop(S.leg),prec=Math.abs(gap);S.lastPrec=prec;S.heat=0;
 setS('DOCKING');vib(slam?[60,40,60]:25);S.bounceV=-3;S.pitchV=slam?3:1;S.shake=slam?1:.3;AU.chime();
 if(slam){S.streak=0;const t=8;S.tips+=t;S.tipsLeg+=t;floatTxt('+'+t);toast('Ouch! Too rough...',true);say('My tea!');sub('*grumble*');}
 else{const base=CFG.tipBase+S.comfort*.6+(prec<=CFG.perfect?35:prec<=4?14:0)+S.paxN*2;if(S.comfort>=60){S.streak++;S.bestStreak=Math.max(S.bestStreak,S.streak);}addTips(base);
  if(prec<=CFG.perfect){S.perfect++;toast('Perfect stop!');S.timeScale=.35;S.tsT=.9;}else toast(S.comfort>=60?'Smooth arrival':'Arrived');say('Smooth as butter!');}
 SV.tips=S.tips;save();}
$('bCont').addEventListener('click',()=>{AU.click();$('sum').classList.remove('on');if(S.leg===0){setS('WORKSHOP');}else{S.leg=0;S.loop++;S.s=CFG.stop;S.ps=S.s;S.v=0;S.perfect=0;hudSet();setS('BOARDING');}});
$('bDep').addEventListener('click',()=>{AU.click();$('shop').classList.remove('on');S.leg=1;S.s=CFG.stop;S.ps=S.s;S.v=0;S.comfort=Math.max(S.comfort,70);hudSet();setS('BOARDING');});
let shopT=0;
const UPS=[['plate','🌿','Hearth Leaves Plating','Swap the iron plate for living green paint.',60,1],['cush','🛋','Cushion Suspension','Less comfort drain from bumps and turns.',50,3],['gyro','🧭','Gyro Stabilizer','Crosswind gusts push less.',55,3],['brk','🪶','Feather Brakes','Smoother, stronger braking.',55,3],['boost','🔥','Steam Boost Engine','More top speed and pull.',80,3],['lant','🏮','Lantern Set & Vine Garden','Hanging lanterns and a growing roof vine.',45,1],['rack','🧳','Extra Luggage Rack','A second rack and 4 more seats (16 to 20).',70,1]];
function buildShop(){$('coins2').textContent='🪙 '+S.tips+' tips to spend';const box=$('ups');box.innerHTML='';UPS.forEach(u=>{const lv=upv(u[0]),mx=u[5],cost=Math.round(u[4]*(lv+1)*2.5),el=document.createElement('div');el.className='up';el.innerHTML=`<div class="i">${u[1]}</div><div><b>${u[2]}</b><span>${u[3]}</span><div class="pips">${'●'.repeat(lv)+'○'.repeat(mx-lv)}</div></div>`;const b=document.createElement('button');b.className='btn';b.textContent=lv>=mx?'Maxed':'🪙 '+cost;b.disabled=lv>=mx||S.tips<cost;b.addEventListener('click',()=>{S.tips-=cost;SV.tips=S.tips;SV.up[u[0]]=lv+1;save();applyUpg();AU.coin();shopT=2.4;$('vtxt').textContent='Sit back and watch it grow...';$('oli').textContent='"Hold steady, working on her..."';if(u[0]==='lant')vineGrow=0;if(u[0]==='plate')S.plateT=0;buildShop();});el.appendChild(b);box.appendChild(el);});}
/* ============ PHYSICS ============ */
function physics(h){const L=legs[S.leg];samp(L,S.s);
 const m=CFG.mass+S.paxN*CFG.paxKg,grade=cur.ty,v=S.v,rain=S.rain;
 let vt=Math.min(CFG.vmax*(1+.06*upv('boost')),zoneLimit(S.s,S.leg));
 let kmax=0;for(let j=0;j<9;j++){const i=Math.min(L.N-1,((S.s+j*8)/DS)|0),k=Math.abs(L.KH[i]);if(k>kmax)kmax=k;}
 const aLim=(CFG.aLat-.1*S.loop)*(1+.08*upv('cush'));if(kmax>.004)vt=Math.min(vt,Math.sqrt(aLim/(.6*kmax))*1.22);
 S.vsafe=kmax>.004?Math.sqrt(aLim/(.6*kmax)):99;S.kA=kmax;
 if(inp.boost)vt+=2.5;
 S.thr=damp(S.thr,v<vt?clamp((vt-v)*.5,0,1):0,1.6,h);if(inp.boost&&v<vt)S.thr=Math.max(S.thr,.8);
 let F_=0;const vv=Math.max(v,CFG.v0);F_+=S.thr*Math.min(CFG.Pmax*(1+.08*upv('boost'))/vv,m*CFG.accMax);
 if(v>vt+.8)F_-=m*CFG.coast;
 F_-=m*CFG.g*grade;if(v>.05)F_-=m*CFG.g*CFG.croll;F_-=.5*CFG.rho*CFG.Cd*CFG.A*v*v;
 const tgt=inp.brake?1:0;S.brk+=clamp(tgt-S.brk,-CFG.brakeDown*h,CFG.brakeUp*h);
 S.heat=clamp(S.heat+S.brk*h*.1*S.v/10-h*.04,0,1);
 const grip=(1-rain*(1-CFG.wetGrip)),fade=1-.35*Math.max(0,S.heat-.5)*2,bmax=(CFG.brakeMax+.35*upv('brk'))*grip*fade;
 const Fb=v>.02?S.brk*m*bmax:0;
 const nv=Math.max(0,v+(F_-Fb)/m*h),a=(nv-v)/h;S.v=nv;S.s+=nv*h;
 const aN=damp(S.aS,a,12,h);S.jS=damp(S.jS,(aN-S.aS)/h,6,h);S.aS=aN;
 // comfort
 let drain=0;const dm=1-.12*upv('cush');
 if(S.aS<-CFG.harsh&&v>.5)drain+=(-S.aS-CFG.harsh)*10;
 if(Math.abs(S.jS)>CFG.jerkLim&&v>1)drain+=(Math.abs(S.jS)-CFG.jerkLim)*.5;
 const felt=Math.abs(v*v*cur.kh)*.6;if(felt>aLim)drain+=(felt-aLim)*14;
 const az=v*v*cur.kv;if(az<-CFG.crestG)drain+=(-az-CFG.crestG)*8;
 // wind
 const z=zones(S.leg),inBr=S.s>z[0]&&S.s<z[1],amp=(.35+.12*S.loop+rain*.25)*(inBr?2.2:1)*(1-.18*upv('gyro'));
 S.windT+=h;const g=(Math.sin(S.windT*.7)*.5+Math.sin(S.windT*1.9+1.3)*.3+Math.sin(S.windT*3.1+.4)*.2);S.gust=g;
 S.lean=damp(S.lean,inp.lean,6,h);S.err=g*amp*1.6-S.lean*.9*(amp>0?1:0)*Math.min(1,amp*1.6);
 if(Math.abs(S.err)>.55&&v>2)drain+=(Math.abs(S.err)-.55)*9;
 if(Math.abs(g)>.45&&Math.abs(S.err)<.2&&v>3)S.steadyT+=h;else S.steadyT=Math.max(0,S.steadyT-h);
 S.steadyCD-=h;if(S.steadyT>1.5&&S.steadyCD<=0){S.steadyCD=6;S.steadyT=0;addTips(10,'Steady hands');toast('Steady hands!');S.streak=S.streak;}
 if(S.bridgeIn&&!inBr){if(!S.bridgeBad&&S.comfort>60){S.streak++;S.bestStreak=Math.max(S.bestStreak,S.streak);addTips(25,'Bridge');toast('Smooth bridge!');}S.bridgeBad=false;}
 S.bridgeIn=inBr;if(inBr&&drain>.5)S.bridgeBad=true;
 // ring gate
 if(S.ringDone!==S.leg&&S.s>z[2]){S.ringDone=S.leg;if(S.comfort>65){S.streak++;S.bestStreak=Math.max(S.bestStreak,S.streak);addTips(30,'Ring gate');toast('Through the ring!');sub('*whoosh*');}}
 // joints
 const ji=Math.floor(S.s/CFG.joint);if(ji!==S.jointI){S.jointI=ji;AU.clack(v);S.bumpV=Math.min(1,v/22);if(v>18)S.comfort-=.25*dm;}
 S.comfort-=drain*dm*h;
 if(drain<.001){S.comfort+=CFG.regen*h*(S.smoothT>3?1.6:1);S.smoothT+=h;}else S.smoothT=0;
 S.comfort=clamp(S.comfort,0,100);
 if(S.smoothT>=CFG.steadyT){S.smoothT=0;S.streak=Math.min(S.streak+1,12);S.bestStreak=Math.max(S.bestStreak,S.streak);toast('Steady meter full! x'+mult().toFixed(2));}
 if(S.comfort<CFG.lowComfort&&!S.lowFlag){S.lowFlag=true;S.streak=0;toast('Uncomfortable...',true);say('Whoa!');sub('*gasp*');}
 if(S.comfort>50)S.lowFlag=false;
 S.cSum+=S.comfort*h;S.cN+=h;
 if(S.st==='RUNNING'){const stop=legStop(S.leg),gap=stop-S.s;
  if(S.s>=L.len-3){S.s=L.len-3;dock(true);}
  else if(S.s>L.len*.5&&S.v<.3&&Math.abs(gap)<CFG.dock){dock(false);}
  else if(S.s>L.len*.5&&S.s>stop+10&&S.v<.3)dock(true);}}
/* ============ CAMERA ============ */
const cp=new T3.Vector3(),cl=new T3.Vector3(),dv=new T3.Vector3(),dl=new T3.Vector3(),tp=new T3.Vector3(),cq=new T3.Vector3();let camInit=false,orbit=0;
function updCam(dt,sr){const L=legs[S.leg];samp(L,sr);const tx=cur.tx,ty=cur.ty,tz=cur.tz;tp.set(cur.px,cur.py+2.2,cur.pz);
 let fov=52+S.v*.55,roll=0;
 const cine=(S.st==='TITLE'||S.st==='DOCKING'||S.st==='SUMMARY'||S.st==='BOARDING'||S.st==='WORKSHOP'||camMode===2);
 if(S.st==='TITLE'||S.st==='WORKSHOP'){orbit+=dt*.12;}else orbit+=dt*.2;
 if(cine&&S.st!=='RUNNING'||camMode===2){const r=S.st==='WORKSHOP'?22:S.st==='TITLE'?30:24,a=orbit+(S.leg?3.1:0);dv.set(tp.x+Math.cos(a)*r,tp.y+8+Math.sin(orbit*.7)*2,tp.z+Math.sin(a)*r);dl.copy(tp);fov=48;}
 else if(camMode===1){dv.set(tp.x+tx*3.2,tp.y+.9,tp.z+tz*3.2);dl.set(tp.x+tx*30,tp.y+ty*30+.5,tp.z+tz*30);fov=70+S.v*.4;roll=-cur.kh*S.v*.2;}
 else{dv.set(tp.x-tx*17+cur.sx*S.lean*2,tp.y+5+ -ty*8,tp.z-tz*17+cur.sz*S.lean*2);dl.set(tp.x+tx*20,tp.y+ty*20+.5,tp.z+tz*20);roll=-cur.kh*S.v*.15*(SV.set.rm?.3:1);}
 if(!camInit){cp.copy(dv);cl.copy(dl);camInit=true;}
 const k=camMode===1&&S.st==='RUNNING'?30:(S.st==='RUNNING'?7:2.5);cp.x=damp(cp.x,dv.x,k,dt);cp.y=damp(cp.y,dv.y,k,dt);cp.z=damp(cp.z,dv.z,k,dt);cl.x=damp(cl.x,dl.x,k*1.4,dt);cl.y=damp(cl.y,dl.y,k*1.4,dt);cl.z=damp(cl.z,dl.z,k*1.4,dt);
 const sh=SV.set.rm?.2:1;cam.position.copy(cp);cam.position.y+=Math.sin(S.t*70)*S.shake*.08*sh+S.bumpV*Math.sin(S.t*90)*.06*sh;cam.lookAt(cl);cam.rotateZ(roll*sh);
 if(Math.abs(cam.fov-fov)>.05){cam.fov=damp(cam.fov,fov,3,dt);cam.updateProjectionMatrix();}}
/* ============ TRAM POSE ============ */
const bm=new T3.Matrix4(),v1=new T3.Vector3(),v2=new T3.Vector3(),v3=new T3.Vector3();
function poseTram(sr,dt){const L=legs[S.leg];samp(L,sr);bm.makeBasis(v1.set(-cur.sx,-cur.sy,-cur.sz),v2.set(cur.ux,cur.uy,cur.uz),v3.set(cur.tx,cur.ty,cur.tz));tram.quaternion.setFromRotationMatrix(bm);tram.position.set(cur.px+cur.ux*.3,cur.py+cur.uy*.3,cur.pz+cur.uz*.3);
 // springs: pitch (nose-down on braking), roll (lean out of curves + wind)
 const pt=-S.aS*.012,rt=cur.kh*S.v*S.v*.012-S.err*.03;
 S.pitchV+=((pt-S.pitch)*60-S.pitchV*9)*dt;S.pitch+=S.pitchV*dt;S.rollV+=((rt-S.roll)*50-S.rollV*8)*dt;S.roll+=S.rollV*dt;S.bounceV+=((0-S.bounce)*90-S.bounceV*10)*dt;S.bounce+=S.bounceV*dt;
 body.rotation.x=S.pitch;body.rotation.z=S.roll;body.position.y=S.bounce*.1+S.bumpV*Math.sin(S.t*55)*.025;
 S.bumpV=Math.max(0,S.bumpV-dt*4);S.shake=Math.max(0,S.shake-dt*2.5);
 wheels.forEach(w=>w.rotation.x=-sr/.5);
 doors.forEach(d=>{const tgt=S.doorOpen?d.userData.dz*1.05:0;d.position.z=damp(d.position.z,d.userData.z0+tgt,5,dt);});
 const ax=-S.aS*.02,lz=cur.kh*S.v*S.v*.03;straps.forEach((s,i)=>{s.rotation.x=damp(s.rotation.x,ax+Math.sin(S.t*2+i)*.02,5,dt);s.rotation.z=damp(s.rotation.z,-lz+Math.sin(S.t*1.7+i)*.02,5,dt);});
 lanternMs.forEach((l,i)=>{l.rotation.z=Math.sin(S.t*1.6+i)*.12-lz*.6;l.rotation.x=ax;});
 let vis=Math.min(20,S.paxN);for(let i=0;i<20;i++){const p=pax[i],on=i<vis;if(p.visible!==on)p.visible=on;if(on){const u=p.userData;p.rotation.z=damp(p.rotation.z,lz*1.1*(u.seated?1:1.4)+Math.sin(S.t*1.2+u.ph)*.02,6,dt);p.rotation.x=damp(p.rotation.x,ax*1.2,6,dt);u.head.position.y=1.2+Math.sin(S.t*2+u.ph)*.015*(S.v>1?1:.3);if(!u.seated)u.legs.visible=true;if(S.doorOpen&&S.st==='DOCKING'){u.arm.rotation.z=2.4+Math.sin(S.t*8+u.ph)*.5;}else u.arm.rotation.z=damp(u.arm.rotation.z,0,6,dt);}}
 // vine growth
 if(vine.visible){const t=S.st==='WORKSHOP'||vineGrow>=vineTarget?vineGrow:vineTarget;const g=upv('lant')?(S.st==='WORKSHOP'?vineGrow:1):0;vineG.setDrawRange(0,Math.floor(vineG.index.count*g));leaves.forEach((l,i)=>l.scale.setScalar(i/22<g?1:.001));}
 S.plateT=Math.min(1,S.plateT+dt*.5);
 sunL.position.set(tram.position.x+sunDir.x*80*(TOD.e>-.02?1:-1),tram.position.y+Math.abs(sunDir.y)*80+10,tram.position.z+sunDir.z*80*(TOD.e>-.02?1:-1));sunL.target.position.copy(tram.position);sunL.target.updateMatrixWorld();}
/* ============ WEATHER ============ */
const rainG=new T3.BufferGeometry(),RN=700,rp=new Float32Array(RN*6),rl=new Float32Array(RN*3);for(let i=0;i<RN;i++){rl[i*3]=(Math.random()-.5)*50;rl[i*3+1]=(Math.random()-.5)*30;rl[i*3+2]=(Math.random()-.5)*50;}
rainG.setAttribute('position',new T3.BufferAttribute(rp,3));const rainM=new T3.LineSegments(rainG,new T3.LineBasicMaterial({color:0xbcd4e6,transparent:true,opacity:0,fog:false}));rainM.frustumCulled=false;scene.add(rainM);
function rainTarget(){const z=[.35*F.len,.65*F.len],L=legs[S.leg].len,s=S.leg?L-S.s:S.s,inz=s>z[0]&&s<z[1];return S.loop>=1?(inz?1:0):(S.leg===1&&inz?.55:0);}
function updRain(dt){const tgt=rainTarget();S.rain=damp(S.rain,tgt,.6,dt);const q=SV.set.rm?.4:1,n=Math.floor(RN*q),r=S.rain;rainM.material.opacity=r*.5;rainM.visible=r>.02;
 if(r>.02){for(let i=0;i<RN;i++){let y=rl[i*3+1]-dt*28;if(y<-15)y+=30;rl[i*3+1]=y;const x=rl[i*3],z=rl[i*3+2];const on=i<n;rp[i*6]=cam.position.x+x;rp[i*6+1]=cam.position.y+y;rp[i*6+2]=cam.position.z+z;rp[i*6+3]=rp[i*6]-(on?.1:0)-S.v*.03*cur.tx;rp[i*6+4]=rp[i*6+1]+(on?1.3:0);rp[i*6+5]=rp[i*6+2]-(on?.1:0)-S.v*.03*cur.tz;}rainG.attributes.position.needsUpdate=true;}
 if(r>.6){if(Math.random()<dt*.15){S.flash=1;AU.thunder();}}S.flash=Math.max(0,S.flash-dt*3);$('wx').textContent=r>.3?'🌧 Rain':(TOD.night>.5?'🌙 Clear':'☀ Sunny');}
/* ============ HUD ============ */
const routeEl=$('route'),routeLen=routeEl.getTotalLength(),ico=$('ico'),arc=$('arc'),routeF=$('routeF');let hudT=0,lastStk='';
function hud(dt){const kmh=S.v*3.6;$('kmh').textContent=Math.round(kmh);arc.setAttribute('stroke-dasharray',clamp(kmh/110,0,1)*100+' 100');
 const lim=Math.min(zoneLimit(S.s,S.leg),S.vsafe*1.0)*3.6,limShow=Math.max(10,Math.round(lim/5)*5);$('lim').textContent='limit '+limShow;$('lim').className=kmh>limShow+6?'over':'';
 $('pax').textContent='👥 '+S.paxN+'/'+maxPax()+' aboard';
 const ph=S.phase,hr=(6+ph*24)%24;$('clk').textContent='🕕 '+String(Math.floor(hr)).padStart(2,'0')+':'+String(Math.floor((hr%1)*60)).padStart(2,'0');
 $('coins').textContent='🪙 '+S.tips;$('strk').textContent='Streak '+S.streak+' · x'+mult().toFixed(2);
 const p=clamp(S.s/legs[S.leg].len,0,1),pt=routeEl.getPointAtLength(p*routeLen);ico.setAttribute('x',pt.x);ico.setAttribute('y',pt.y-6);routeF.setAttribute('stroke-dasharray',p*100+' 100');
 const c=S.comfort,col=c>70?'#3a9d5d':c>40?'#e0a020':'#d8483a';routeF.setAttribute('stroke',col);$('cmfv').textContent='Comfort '+Math.round(c)+(c>70?' 🙂':c>40?' 😐':' 😣');
 $('edge').className='ov'+(c<CFG.lowComfort?' bad':'');$('spd').style.opacity=clamp((S.v-17)/6,0,1)*(SV.set.rm?.3:1);
 const d=legStop(S.leg)-S.s,req=S.v*S.v/(2*Math.max(d,1));
 $('cue').innerHTML=(S.st==='RUNNING'&&d<600&&d>-20?'Stop mark in <b>'+Math.max(0,Math.round(d))+' m</b>'+(req>1.2&&S.v>2?'<span class="brk">BRAKE</span>':''):'');
 const wa=$('warn');if(S.kA>.012&&S.st==='RUNNING'){wa.style.display='block';wa.textContent='⚠ Curve ahead · '+Math.round(S.vsafe*3.6/5)*5+' km/h';}else wa.style.display='none';
 $('windA').style.transform='scaleX('+(S.gust>0?1:-1)+') scale('+(.7+Math.abs(S.gust))+')';$('windA').style.opacity=.35+Math.abs(S.gust);
 $('bCam').textContent=['🎥','🪟','🎬'][camMode];
 if(subT>0){subT-=dt;if(subT<=0)$('sub').style.display='none';}if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').className='';}
 if(bubT>0){bubT-=dt;if(bubP){bubP.getWorldPosition(tmpV);tmpV.y+=.8;tmpV.project(cam);bub.style.left=(tmpV.x*.5+.5)*innerWidth+'px';bub.style.top=(-tmpV.y*.5+.5)*innerHeight+'px';}if(bubT<=0)bub.style.display='none';}}
/* ============ QUALITY / RESIZE ============ */
function setQ(q){quality=q;const c=CFG.q[q];R.setPixelRatio(Math.min(devicePixelRatio||1,2)*c.pr);R.setSize(innerWidth,innerHeight,false);sunL.castShadow=c.sh;R.shadowMap.enabled=c.sh;clouds.forEach((s,i)=>s.visible=i<c.cl+(i>=40?0:0));scene.traverse(o=>{if(o.isMesh&&o.material&&!Array.isArray(o.material))o.material.needsUpdate=true;});}
function resize(){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();R.setPixelRatio(Math.min(devicePixelRatio||1,2)*CFG.q[quality].pr);R.setSize(innerWidth,innerHeight,false);}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,200));
/* ============ PAUSE / MENUS ============ */
function togglePause(){if(S.st==='TITLE'||S.st==='SUMMARY'||S.st==='WORKSHOP')return;if(!paused){paused=true;pausedFrom=S.st;$('pause').classList.add('on');}else{paused=false;$('pause').classList.remove('on');$('set').classList.remove('on');}}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused)togglePause();});
$('bPause').addEventListener('click',()=>{AU.click();togglePause();});$('bResume').addEventListener('click',()=>{AU.click();togglePause();});$('bMute').addEventListener('click',()=>{AU.init();toggleMute();});$('bCam').addEventListener('click',()=>{camMode=(camMode+1)%3;AU.click();});
$('bHelp').addEventListener('click',()=>$('help').classList.add('on'));$('bHow').addEventListener('click',()=>{AU.init();$('help').classList.add('on');});$('bHelpX').addEventListener('click',()=>$('help').classList.remove('on'));
const openSet=()=>{AU.init();$('set').classList.add('on');};$('bSet').addEventListener('click',openSet);$('bSet2').addEventListener('click',openSet);$('bSetX').addEventListener('click',()=>{$('set').classList.remove('on');save();});
function bindSet(){const s=SV.set;$('sVol').value=s.vol;$('sMus').value=s.music;$('sSfx').value=s.sfx;$('sQ').value=s.q;$('sSub').checked=!!s.subs;$('sRM').checked=!!s.rm;
 $('sVol').oninput=e=>{s.vol=+e.target.value;AU.vol();};$('sMus').oninput=e=>{s.music=+e.target.value;AU.vol();};$('sSfx').oninput=e=>{s.sfx=+e.target.value;AU.vol();};
 $('sQ').onchange=e=>{s.q=+e.target.value;autoQ=s.q<0;if(!autoQ)setQ(s.q);save();};$('sSub').onchange=e=>{s.subs=e.target.checked?1:0;save();};$('sRM').onchange=e=>{s.rm=e.target.checked?1:0;save();};}
$('bStart').addEventListener('click',()=>{AU.init();AU.click();if(S.st==='TITLE'){S.s=S.ps=CFG.stop;S.tips=SV.tips;hudSet();setS('BOARDING');}});
/* ============ MAIN LOOP ============ */
let last=performance.now(),acc=0,fAcc=0,fN=0,goodWin=0;
function frame(now){requestAnimationFrame(frame);let dt=Math.min(.1,(now-last)/1000);last=now;
 fAcc+=dt;fN++;if(fN>=90){const avg=fAcc/fN;fAcc=0;fN=0;if(autoQ){if(avg>.026&&quality>0){setQ(quality-1);goodWin=0;}else if(avg<.0165&&quality<2){if(++goodWin>=4){setQ(quality+1);goodWin=0;}}else goodWin=0;}}
 if(!paused){
  if(S.tsT>0){S.tsT-=dt;if(S.tsT<=0)S.timeScale=1;}const sdt=dt*S.timeScale;S.t+=sdt;
  pad();life(sdt);const u=ST[S.st];if(u.update)u.update(sdt);
  if(S.st==='RUNNING'){acc+=sdt;while(acc>=CFG.step){S.ps=S.s;physics(CFG.step);acc-=CFG.step;if(S.st!=='RUNNING')break;}}else{acc=0;S.ps=S.s;S.v=0;S.aS=damp(S.aS,0,6,sdt);S.brk=0;}
  const alpha=S.st==='RUNNING'?acc/CFG.step:0;
  S.phase=((S.leg+clamp(S.s/legs[S.leg].len,0,1))*.5)%1;
  const sr=lerp(S.ps,S.s,alpha);
  tod();poseTram(sr,sdt);updCam(sdt,sr);updRain(sdt);hud(sdt);AU.update(S.v,S.brk,S.rain);
  seaU.t.value=S.t;sea.position.set(Math.round(cam.position.x/40)*40,0,Math.round(cam.position.z/40)*40);sky.position.copy(cam.position);stars.position.copy(cam.position);
  if(S.st==='WORKSHOP'||S.st==='TITLE'||true){ring.rotation.z+=sdt*.25;if(W_){W_.gear.rotation.z+=sdt*.8;W_.oliver.userData.arm.rotation.z=2.6+Math.sin(S.t*5)*.5;W_.steam.forEach((s,i)=>{const ph=(S.t*.5+i/3)%1;s.position.y=11+ph*10;s.material.opacity=1-ph;});}}
  balloons.forEach((b,i)=>{b.position.y+=Math.sin(S.t*.4+i)*.01;b.rotation.y+=sdt*.05;});whale.position.x+=sdt*1.5;if(whale.position.x>420)whale.position.x=-420;
  boats.forEach((b,i)=>{b.position.y=.3+Math.sin(S.t*.9+i)*.35;b.rotation.z=Math.sin(S.t*.7+i)*.05;});
  crowd.forEach((c,i)=>{const near=S.st==='DOCKING'||S.st==='BOARDING';c.userData.arm.rotation.z=near?2.5+Math.sin(S.t*6+i)*.5:0;});}
 R.render(scene,cam);}
/* ===== v2 LIFE & POLISH: birds, steam, stop beacon, shooting stars, chatter, gamepad, haptics, trip stars ===== */
const vib=n=>{try{if(!SV.set.rm&&navigator.vibrate)navigator.vibrate(n);}catch(e){}};
const birds=[];for(let i=0;i<18;i++){const g=new T3.Group(),m=toon(0xf6efe0,{side:T3.DoubleSide}),o={};samp(F,(.05+.9*i/18)*F.len,o);
 const w1=mesh(new T3.PlaneGeometry(1.1,.35).rotateX(-Math.PI/2).translate(-.55,0,0),m,0,0,0,g),w2=mesh(new T3.PlaneGeometry(1.1,.35).rotateX(-Math.PI/2).translate(.55,0,0),m,0,0,0,g);
 g.userData={c:new T3.Vector3(o.px+(i%2?1:-1)*(40+i*3),o.py+10+(i%5)*4,o.pz),r:12+i%4*5,ph:i*.9,w1,w2,sp:.35+.1*(i%3)};scene.add(g);birds.push(g);}
const puffs=[];for(let i=0;i<14;i++){const sp=new T3.Sprite(new T3.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,opacity:0}));sp.userData={a:i/14,o:new T3.Vector3(),d:new T3.Vector3()};scene.add(sp);puffs.push(sp);}
const beacon=mesh(new T3.CylinderGeometry(.6,.6,46,12,1,true),new T3.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.3,blending:T3.AdditiveBlending,depthWrite:false,side:T3.DoubleSide,fog:false}),0,0,0,scene);
const shoot=mesh(new T3.PlaneGeometry(70,.7),new T3.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:T3.AdditiveBlending,depthWrite:false,fog:false}),0,0,0,scene);shoot.frustumCulled=false;
let shT=0,shCD=5,chatT=12,hintT=0,hinted=false;const bo={},tw=new T3.Vector3(),LN={rain:['Pitter-patter on the roof!','Hope it clears soon...'],night:['Look at all those stars!','The lanterns of Mango Tide!'],day:['What a view!','Is that a sky-whale?','Tea tastes better up here.','Wave at the balloons!']};
function pad(){recalc();const gp=navigator.getGamepads&&navigator.getGamepads()[0];if(!gp)return;const b=i=>gp.buttons[i]?gp.buttons[i].value:0;if(b(6)>.25||b(0)||b(1))inp.brake=1;if(b(7)>.25||b(2))inp.boost=1;const ax=gp.axes[0]||0;if(Math.abs(ax)>.2)inp.lean=clamp(ax,-1,1);if(b(9)&&!pad.p)togglePause();pad.p=b(9);}
function life(dt){const t=S.t;
 birds.forEach(g=>{const u=g.userData,a=t*u.sp+u.ph,f=Math.sin(t*9+u.ph)*.7;g.position.set(u.c.x+Math.cos(a)*u.r,u.c.y+Math.sin(t*.5+u.ph)*1.5,u.c.z+Math.sin(a)*u.r);g.rotation.y=-a;u.w1.rotation.z=f;u.w2.rotation.z=-f;});
 const vv=Math.min(1,S.v/6+.25);samp(legs[S.leg],S.s,bo);
 puffs.forEach(p=>{const u=p.userData,pa=u.a;u.a=(u.a+dt*.6)%1;if(u.a<pa){u.o.set(bo.px+bo.tx*4.5+bo.ux*5.4,bo.py+bo.ty*4.5+bo.uy*5.4,bo.pz+bo.tz*4.5+bo.uz*5.4);u.d.set(-bo.tx*S.v*.5,2.2,-bo.tz*S.v*.5);}
  p.position.set(u.o.x+u.d.x*u.a,u.o.y+u.d.y*u.a*2.4,u.o.z+u.d.z*u.a);p.scale.setScalar(1.4+u.a*6);p.material.opacity=(1-u.a)*.45*vv*(1-S.rain*.4);p.material.color.copy(cloudMat.color);});
 const d=legStop(S.leg)-S.s;beacon.visible=S.st==='RUNNING'&&d<420&&d>-10;if(beacon.visible){beacon.position.set(bo.px,bo.py,bo.pz);samp(legs[S.leg],legStop(S.leg),bo);beacon.position.set(bo.px+bo.sx*2.6,bo.py+22,bo.pz+bo.sz*2.6);beacon.material.opacity=.2+.12*Math.sin(t*4);}
 shCD-=dt;if(shCD<0&&TOD.night>.6&&shT<=0){shT=1;shCD=7+Math.random()*8;shoot.position.set(cam.position.x+(Math.random()-.5)*1400,cam.position.y+500+Math.random()*400,cam.position.z-900-Math.random()*400);}
 if(shT>0){shT-=dt*1.1;shoot.position.x+=dt*900;shoot.lookAt(cam.position);shoot.material.opacity=Math.max(0,shT);}
 if(S.st==='RUNNING'){if(!hinted){hintT+=dt;if(hintT>2.5){hinted=true;if(S.loop===0&&S.leg===0)sub('Hold Space to brake. Stop at the golden beam!');}}
  chatT-=dt;if(chatT<=0){chatT=14+Math.random()*10;const L2=S.rain>.4?LN.rain:TOD.night>.5?LN.night:LN.day;say(L2[(Math.random()*L2.length)|0]);}}}
scene.traverse(o=>{if(o.isInstancedMesh)o.frustumCulled=false;});
resize();setQ(1);bindSet();cps();applyUpg();hudSet();vineGrow=vineTarget;tod();setS('TITLE');
if(SV.set.q>=0){autoQ=false;setQ(SV.set.q);}
requestAnimationFrame(frame);
})();
