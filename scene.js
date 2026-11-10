(() => {
  'use strict';
  const { pose,bench,sides,add,sub,mul,dot,cross,unit,mix,clamp } = PushupPose;
  const TAU = 2 * Math.PI;
  const cameraPresets = { three:[.47,.37], side:[0,.12], front:[1.50,.55] };
  const standingPresets = { three:[.78,.22], side:[.02,.12], front:[1.56,.13] };
  const light = unit([-.27,.86,.65]);
  // Warm body tones stay distinct from the cool blue support, including in shadow.
  const skin = [224,194,160], dark = [113,87,105], warm = [222,97,51];
  const shoe = [31,40,47], sole = [127,146,152];

  function setup(canvas) {
    const ctx = canvas.getContext('2d');
    let az = cameraPresets.three[0], el = cameraPresets.three[1], zoom = 1;
    let w,h,camera,right,up,center,scale,faces,supportY;
    const flat = (p,r,d) => [dot(p,r),dot(p,d)];
    function project(p) {
      const q = sub(p,center), depth = dot(q,camera), k = scale * 5.6 / (5.6-depth);
      const [x,y] = flat(q,right,up);
      return [w*.50 + k*x,h*.53-k*y,depth];
    }
    function face(points, color, normal) {
      const n = unit(normal), mid = mul(points.reduce(add),1/points.length);
      if (dot(n,sub(add(center,mul(camera,5.6)),mid)) <= 0) return;
      const intensity = .58 + .43 * Math.max(0,dot(n,light)) + .08 * Math.max(0,n[2]);
      const rgb = color.map(x => Math.min(255,Math.round(x*intensity+5)));
      // A large tabletop's average depth can be nearer than a palm above it.
      // Split at the support plane first: the camera is always above this plane,
      // so its upper half-space must paint after the surface and lower half.
      const above = supportY != null && points.some(p=>p[1]>supportY+1e-8);
      const below = supportY != null && points.some(p=>p[1]<supportY-1e-8);
      const parts = above && below
        ? [{points:clipSupport(points,false),layer:0},{points:clipSupport(points,true),layer:1}]
        : [{points,layer:above?1:0}];
      for(const part of parts) {
        if(part.points.length<3) continue;
        const projected = part.points.map(project);
        faces.push({p:projected,z:projected.reduce((s,x)=>s+x[2],0)/projected.length,
          layer:part.layer,c:'rgb('+rgb.join(',')+')'});
      }
    }
    function clipSupport(points,upper) {
      const result=[];
      for(let i=0;i<points.length;i++) {
        const a=points[i], b=points[(i+1)%points.length];
        const insideA=upper?a[1]>=supportY:a[1]<=supportY;
        const insideB=upper?b[1]>=supportY:b[1]<=supportY;
        if(insideA) result.push(a);
        if(insideA!==insideB) result.push(mix(a,b,(supportY-a[1])/(b[1]-a[1])));
      }
      return result;
    }
    function rings(a,b,profile,color,{u,v,n=22,paint,bow} = {}) {
      const d = unit(sub(b,a));
      u ||= unit(cross(d,Math.abs(d[2])>.9?[0,1,0]:[0,0,1]));
      v ||= unit(cross(d,u));
      const pathAt=t=>bow?add(mix(a,b,t),mul(bow,Math.sin(Math.PI*t))):mix(a,b,t);
      const rows = profile.map(([t,r,s]) => {
        const o = pathAt(t);
        return Array.from({length:n+1},(_,j)=>{
          const k=TAU*j/n;
          return add(o,add(mul(u,r*Math.cos(k)),mul(v,s*Math.sin(k))));
        });
      });
      for (let i=0;i<rows.length-1;i++) for (let j=0;j<n;j++) {
        const q = [rows[i][j], rows[i][j+1], rows[i+1][j+1], rows[i+1][j]];
        const c = cross(sub(q[1],q[0]),sub(q[3],q[0]));
        if (Math.hypot(...c) < 1e-8) continue;
        const t=(profile[i][0]+profile[i+1][0])*.5;
        const outward = sub(mul(q.reduce(add),.25),pathAt(t));
        face(q,paint?.(t,TAU*(j+.5)/n) || color,dot(c,outward)>=0?c:mul(c,-1));
      }
      face(rows[0].slice(0,-1),color,mul(d,-1));
      face(rows.at(-1).slice(0,-1),color,d);
    }
    function ellipsoid(a,b,r,s,c,opt={}) {
      const profile = Array.from({length:13},(_,i)=>{
        const t = i*Math.PI/12;
        const y = Math.max(.002,Math.sin(t));
        return [(1-Math.cos(t))/2,r*y,s*y];
      });
      rings(a,b,profile,c,opt);
    }
    function limb(a,b,r1,r2,color,opt={}) {
      const axis = unit(sub(b,a));
      const start = add(a,mul(axis,-r1*.63)), end = add(b,mul(axis,r2*.67));
      rings(start,end,[[0,.004,.004],[.045,r1*.66,r1*.62],[.13,r1,r1*.94],
        [.33,r1*1.06,r1],[.59,(r1+r2)*.47,(r1+r2)*.44],
        [.87,r2,r2*.91],[.96,r2*.57,r2*.54],[1,.003,.003]],color,{n:18,...opt});
    }
    function box(x1,x2,y1,y2,z1,z2,color) {
      const a=[x1,y1,z1], b=[x2,y1,z1], c=[x2,y1,z2], d=[x1,y1,z2];
      const A=[x1,y2,z1], B=[x2,y2,z1], C=[x2,y2,z2], D=[x1,y2,z2];
      face([A,B,C,D],color,[0,1,0]); face([a,b,c,d],color,[0,-1,0]);
      face([a,b,B,A],color,[0,0,-1]); face([c,d,D,C],color,[0,0,1]);
      face([a,d,D,A],color,[-1,0,0]); face([b,c,C,B],color,[1,0,0]);
    }
    function trace(points, color, width=1, dash=[]) {
      const coords=points.map(project);
      ctx.beginPath(); ctx.moveTo(...coords[0].slice(0,2));
      for (const p of coords.slice(1)) ctx.lineTo(p[0],p[1]);
      ctx.setLineDash(dash);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();ctx.setLineDash([]);
    }
    function ground() {
      for (let i=-10;i<=10;i++) {
        const d = i*.20;
        const opacity = .13 - Math.min(.10,Math.abs(d)*.038);
        trace([[d,0,-2.1],[d,0,1.9]],'rgba(116,139,154,'+opacity+')');
        trace([[-2.2,0,d],[1.65,0,d]],'rgba(116,139,154,'+opacity+')');
      }
      const shadow = (o,rx,rz,alpha) => {
        for(let i=11;i>=1;i--) {
          const s = i/11;
          ctx.beginPath();
          for(let j=0;j<=40;j++) {
            const t=j*TAU/40, p=project(add(o,[rx*s*Math.cos(t),0,rz*s*Math.sin(t)]));
            if(j) ctx.lineTo(p[0],p[1]); else ctx.moveTo(p[0],p[1]);
          }
          ctx.fillStyle='rgba(0,0,0,'+(alpha*(1.1-s*.62))+')';ctx.fill();
        }
      };
      shadow([-.51,0,0],1.29,.49,.09);
      shadow([.24,0,0],.68,.69,.13);
    }
    function platform({front:f,back:b,top:y,halfWidth:z}=bench) {
      for(const s of sides) {
        const p=z*.77*s;
        box(f+.065,b-.065,.015,.065,p-.06,p+.06,[25,53,70]);
        for(const x of [f+.14,b-.14]) box(x-.043,x+.043,.04,y-.074,p-.043,p+.043,[33,70,91]);
      }
      box(f+.025,b-.025,y-.111,y-.065,-z+.02,z-.02,[24,49,66]);
      box(f,b,y-.069,y-.009,-z,z,[34,88,122]);
      box(f+.007,b-.007,y-.012,y,-z+.008,z-.008,[49,119,158]);
      box(f-.002,f+.001,y-.060,y-.052,-z+.015,z-.015,[115,189,218]);
      for(const s of sides) {
        const q=z*s;
        box(f+.047,b-.047,y-.062,y-.056,q-.001,q+.001,[88,155,187]);
      }
    }
    function athlete(p, highlight) {
      const front = [p.axis[1],-p.axis[0],0], lat = [0,0,1];
      const torsoEnd = add(p.shoulder,mul(p.axis,.068)), torsoStart = mix(p.hip,p.shoulder,.07);
      const torso = [[0,.104,.145],[.14,.115,.144],[.33,.109,.156],[.51,.123,.176],
        [.68,.137,.197],[.84,.126,.209],[.94,.095,.178],[1,.064,.083]];
      for(const s of sides) {
        const point = (v,z) => add(v,[0,0,z*s]);
        const hip = point(p.hip,.104), knee = point(p.knee,.120), ankle = point(p.ankle,.125);
        limb(hip,knee,.107,.060,dark);
        limb(knee,ankle,.064,.037,skin);
        const shoeEnd=point([-1.295,.042,0],.125), shoeStart=point([-1.161,.186,0],.125);
        ellipsoid(shoeStart,shoeEnd,.053,.056,shoe,{n:16});
        ellipsoid(add(shoeStart,[-.032,.008,0]),add(shoeEnd,[-.012,-.032,0]),.020,.050,sole,{n:14});
      }
      ellipsoid(add(p.hip,mul(p.axis,-.19)),add(p.hip,mul(p.axis,.15)),.123,.192,dark,{u:front,v:lat});
      const fromFront=k=>Math.min(k,TAU-k);
      rings(torsoStart,torsoEnd,torso,skin,{u:front,v:lat,n:42,
        paint:(t,k)=>highlight && t>.50 && t<.90 && fromFront(k)>.09 &&
          fromFront(k)<(t>.61 && t<.84?1.02:.70) ? warm : null});
      limb(p.shoulder,p.neck,.072,.062,skin);
      const faceDown = [p.neckAxis[1],-p.neckAxis[0],0];
      const headA=add(p.head,mul(p.neckAxis,-.092)), headB=add(p.head,mul(p.neckAxis,.105));
      ellipsoid(headA,headB,.080,.072,skin,{u:faceDown,v:lat,n:24,
        paint:(t,k)=>t>.31 && fromFront(k)>(t>.70?1.05:1.75)?[56,67,75]:null});
      ellipsoid(add(p.head,mul(faceDown,.066)),add(add(p.head,mul(p.neckAxis,.026)),mul(faceDown,.10)),.018,.014,skin,{n:10});
      for(const s of sides) {
        const a = p.arms[s===1?1:0];
        const ear=add(p.head,[0,0,.069*s]);
        ellipsoid(add(ear,mul(p.neckAxis,-.022)),add(ear,mul(p.neckAxis,.019)),.018,.012,skin,{n:10});
        const armAxis=unit(sub(a.elbow,a.shoulder)), back=[-.77,.3,.56*s];
        const armBack=unit(sub(back,mul(armAxis,dot(armAxis,back))));
        limb(a.shoulder,a.elbow,.083,.047,skin,{u:armBack,n:22,
          paint:(t,k)=>highlight && t>.12 && t<.70 && fromFront(k)<(t<.40?1.05:.74)?warm:null});
        limb(a.elbow,a.wrist,.054,.030,skin);
        const palm = [a.wrist[0]+.028,bench.top+.025,a.wrist[2]];
        ellipsoid(add(palm,[-.055,0,0]),add(palm,[.080,0,0]),.025,.047,skin,{n:16});
        for(let j=0;j<4;j++){
          const f=add(palm,[.054,-.006,(j-1.5)*.018]);
          ellipsoid(f,add(f,[.054-Math.abs(j-1)*.006,-.005,0]),.011,.009,skin,{n:8});
        }
      }
    }
    function dumbbell(center, axis) {
      const offset = distance => add(center,mul(axis,distance));
      const metal=[142,156,160], iron=[44,54,61], rim=[98,111,115];
      rings(offset(-.07),offset(.07),[[0,.014,.014],[1,.014,.014]],metal,{n:10});
      for(const side of sides) {
        const end=offset(.115*side), start=offset(.057*side);
        rings(start,end,[[0,.032,.032],[.20,.045,.045],[.80,.045,.045],[1,.036,.036]],iron,{n:6});
        rings(offset(.108*side),offset(.119*side),[[0,.026,.026],[1,.026,.026]],rim,{n:6});
      }
    }
    function standingAthlete(p, id, highlight) {
      const front=p.forward, lateral=p.lateral;
      const isBack = ['singleRow','doubleRow'].includes(id);
      const isLeg = ['squat','rdl','lunge'].includes(id);
      const isShoulder = ['press','lateral','front','fly'].includes(id);
      const isBicep = ['curl','hammer'].includes(id);
      const isTricep = ['overhead','kickback','press'].includes(id);
      const near = (angle,target,width) => Math.cos(angle-target)>Math.cos(width);
      const band = (direction,start=.2,end=.76,width=.94) =>
        (t,angle)=>t>start && t<end && near(angle,direction,width)?warm:null;
      const torsoA=add(p.hip,mul(p.axis,-.095)), torsoB=add(p.shoulder,mul(p.axis,.064));
      const torsoProfile=[[0,.105,.143],[.12,.127,.169],[.23,.113,.158],[.37,.108,.143],
        [.53,.115,.161],[.70,.128,.187],[.85,.121,.205],[.94,.092,.168],[1,.061,.087]];
      for(const leg of p.legs) {
        const active = leg === p.legs[p.active>0?1:0];
        const thighColor=highlight && (isLeg||(['knee','march'].includes(id)&&active))?
          {u:[0,0,1],paint:band(id==='rdl'?Math.PI/2:Math.PI*1.5,.14,.72,1.02)}:{};
        const calfColor=highlight&&id==='calf'?{u:[0,0,1],paint:band(Math.PI/2,.12,.72,1.13)}:{};
        limb(leg.hip,leg.knee,.102,.058,dark,thighColor);
        limb(leg.knee,leg.ankle,.068,.034,skin,calfColor);
        const soleHeel=add(leg.ankle,[-.066,-.060,0]);
        ellipsoid(add(soleHeel,[-.010,.015,0]),add(leg.toe,[.023,.013,0]),.041,.061,shoe,{n:16});
        ellipsoid(add(soleHeel,[0,-.014,0]),add(leg.toe,[.022,-.014,0]),.013,.062,sole,{n:14});
        ellipsoid(add(leg.ankle,[-.047,-.040,0]),add(leg.ankle,[.048,-.005,0]),.043,.050,shoe,{n:14});
      }
      rings(torsoA,torsoB,torsoProfile,skin,{
        u:front,v:lateral,n:32,bow:p.spineBow,paint:(t,k)=>{
          if(highlight && isLeg && t<.28 && near(k,Math.PI,.95)) return warm;
          if(t<.29) return dark;
          if(highlight && isBack && t>.44 && t<.88 && near(k,Math.PI,1.40) && !near(k,Math.PI,.23)) return warm;
          if(highlight && id==='hold' && t>.28 && t<.65 && near(k,p.active>0?Math.PI*1.5:Math.PI*.5,.80)) return warm;
          return null;
        }
      });
      limb(p.shoulder,p.neck,.069,.057,skin);
      const headFront=cross(p.headAxis,lateral);
      const headA=add(p.head,mul(p.headAxis,-.100)), headB=add(p.head,mul(p.headAxis,.107));
      ellipsoid(headA,headB,.078,.072,skin,{u:headFront,v:lateral,n:24,
        paint:(t,k)=>t>.35 && !near(k,0,t>.70?1.08:1.79)?[56,67,75]:null});
      ellipsoid(add(p.head,mul(headFront,.067)),add(add(p.head,mul(p.headAxis,.022)),mul(headFront,.104)),
        .018,.014,skin,{n:10});
      for(const side of sides) {
        const a=p.arms[side===1?1:0], out=mul(lateral,side);
        const ear=add(p.head,mul(out,.067));
        ellipsoid(add(ear,mul(p.headAxis,-.022)),add(ear,mul(p.headAxis,.020)),.016,.013,skin,{n:10});
        if (highlight && isShoulder) {
          const target = id==='fly'?mul(front,-1):id==='front'?front:out;
          const direction=unit(add(target,mul(out,.22)));
          const center=add(a.shoulder,mul(direction,.019));
          ellipsoid(add(center,mul(p.axis,-.097)),add(center,mul(p.axis,.076)),.070,.074,[177,92,59],{n:16});
        }
        const upperAxis=unit(sub(a.elbow,a.shoulder));
        const paintedSide=isBicep?front:mul(front,-1);
        const bias=add(paintedSide,mul(out,.55));
        const surface=unit(sub(bias,mul(upperAxis,dot(bias,upperAxis))));
        limb(a.shoulder,a.elbow,.077,.045,skin,{
          n:20,u:surface,paint:highlight&&(isBicep||isTricep)?band(0,.15,.78,1.1):undefined
        });
        limb(a.elbow,a.wrist,.050,.031,skin);
        const handDir=a.support?[1,-.6,0]:unit(sub(a.wrist,a.elbow));
        const hand=add(a.wrist,mul(handDir,.035));
        ellipsoid(add(a.wrist,mul(handDir,-.025)),add(hand,mul(handDir,.043)),.033,.036,skin,{n:14});
        if(a.weight) dumbbell(hand,a.grip);
      }
      if(p.overhead) dumbbell(p.overhead.center,p.overhead.axis);
    }
    function standingGuides(p,id,state) {
      const arm=p.arms[p.active>0?1:0], leg=p.legs[p.active>0?1:0];
      const otherLeg=p.legs[p.active>0?0:1];
      const nearSide=Math.cos(az)>0?1:-1;
      const cue=state.error==='none'?'#fbbb89':'#ff8776';
      const notes={
        overhead:[arm.elbow,'固定上臂'], kickback:[arm.elbow,'肘部留在身侧'],
        singleRow:[arm.elbow,'肘向腰侧'], doubleRow:[arm.elbow,'肘向腰侧'],
        fly:[arm.elbow,'肘微屈'], curl:[arm.elbow,'肘部留在身侧'], hammer:[arm.wrist,'掌心相对'],
        squat:[leg.knee,'膝盖随脚尖'], rdl:[p.hip,'臀部向后'], lunge:[otherLeg.knee,'前脚压稳'],
        calf:[leg.ankle,'缓慢提踵'], press:[arm.wrist,'推向头顶'], lateral:[arm.elbow,'手臂向外抬'],
        front:[arm.wrist,'抬到接近肩高'], knee:[leg.knee,'提膝稳住骨盆'], march:[leg.knee,'落稳后再换边'],
        hold:[p.shoulder,'双肩保持水平']
      };
      let [point,caption]=notes[id];
      if(p.spineBow) point=add(mix(p.hip,p.shoulder,.60),p.spineBow);
      const [x]=project(point);
      const labelX = x>w*.54?w*.08:w*.68;
      const labelY = id==='calf'?h*.70:id==='squat'||id==='lunge'?h*.63:h*.27;
      label(point,state.error==='none'?caption:state.mistake,labelX,labelY,cue);
      if (id==='hold') {
        trace([[-.006,.10,0],[-.006,1.71,0]],'rgba(246,181,136,.55)',1.2,[4,5]);
      } else if (['singleRow','doubleRow','rdl','kickback','fly'].includes(id)) {
        const side=[0,0,.17*nearSide];
        const points=p.spineBow?[p.hip,add(mix(p.hip,p.shoulder,.60),p.spineBow),p.shoulder,p.head]:
          [p.hip,p.shoulder,p.head];
        trace(points.map(point=>add(point,side)),'rgba(246,181,136,.48)',1.2,[4,5]);
      }
    }
    function label(point,name,x,y,color) {
      const [px,py] = project(point);
      ctx.font='600 12px "Microsoft YaHei", sans-serif';
      const tw=ctx.measureText(name).width+19;
      const xx=clamp(x,9,w-tw-9), yy=clamp(y,52,h-56);
      const endX=xx+(px<xx?0:tw), endY=yy+12;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo((px+endX)/2,endY);ctx.lineTo(endX,endY);
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=.80;ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,3.4,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(15,20,24,.96)';ctx.beginPath();ctx.roundRect(xx,yy,tw,24,4);ctx.fill();
      ctx.strokeStyle='rgba(153,166,173,.40)';ctx.stroke();
      ctx.fillStyle=color;ctx.textBaseline='middle';ctx.fillText(name,xx+9,yy+12);
    }
    function draw(state) {
      const rect=canvas.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      w=rect.width;h=rect.height;
      const dpr=Math.min(window.devicePixelRatio||1,1.65);
      const W=Math.round(w*dpr), H=Math.round(h*dpr);
      if(canvas.width!==W || canvas.height!==H){canvas.width=W;canvas.height=H;}
      ctx.setTransform(W/w,0,0,H/h,0,0);ctx.clearRect(0,0,w,h);
      const bg=ctx.createRadialGradient(w*.51,h*.43,0,w*.53,h*.48,w*.68);
      bg.addColorStop(0,'#232e35');bg.addColorStop(.72,'#151d23');bg.addColorStop(1,'#12181d');
      ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      camera=[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];
      right=[Math.cos(az),0,-Math.sin(az)];up=cross(camera,right);
      const standing=Boolean(state.rig);
      center=standing?[.02,['press','overhead'].includes(state.rig)?1.06:.91,0]:[-.25,.54,0];
      scale=(standing?Math.min(w*.48,h*.395):Math.min(w*.395,h*.64))*zoom;
      ground();faces=[];supportY=null;
      let p;
      if(standing) {
        p=StandingPose.pose(state.rig,state.progress,state.side,state.error==='none'?'':state.error);
        if(p.support) {
          supportY=StandingPose.supportHeight;
          platform({front:.42,back:.97,top:supportY,halfWidth:.47});
        }
        standingAthlete(p,state.rig,state.muscles);
      } else {
        supportY=bench.top;
        platform();
        p=pose(state.progress,state.variant,state.error);
        athlete(p,state.muscles);
      }
      faces.sort((a,b)=>a.layer-b.layer || a.z-b.z);
      for(const f of faces) {
        ctx.beginPath();ctx.moveTo(f.p[0][0],f.p[0][1]);
        for(const pt of f.p.slice(1)) ctx.lineTo(pt[0],pt[1]);
        ctx.closePath();ctx.fillStyle=ctx.strokeStyle=f.c;ctx.lineWidth=.55;ctx.stroke();ctx.fill();
      }
      if(!state.guides) return;
      if(standing) {
        standingGuides(p,state.rig,state);
        return;
      }
      const cue=state.error==='none'?'#fbbb89':'#ff8776';
      const frontSide = Math.cos(az)<0?-1:1;
      const z = .225 * frontSide;
      const linePoint=v=>add(v,[0,.040,z]);
      const ideal=pose(state.progress,state.variant);
      const alignment=[linePoint(ideal.ankle),linePoint(add(ideal.head,[0,.018,0]))];
      trace(alignment,'rgba(246,181,136,.65)',1.3,[5,6]);
      if(state.error==='sag') trace([p.ankle,p.hip,p.shoulder].map(linePoint),cue,1.8,[4,4]);
      const arm=p.arms[frontSide===1?1:0];
      const joint=state.error==='neck'?p.head:state.error==='sag'?linePoint(p.hip):arm.elbow;
      const cueText={sag:'腰髋下沉',flare:'肘部外张',neck:'头部前探'}[state.error];
      if(cueText) label(joint,cueText,w*.71,h*.30,cue);
      else {
        label(linePoint(p.hip),'身体对线',w*(w<480?.14:.18),h*.22,cue);
        label(state.progress>=.18 && state.progress<.86?arm.elbow:arm.wrist,
          state.progress>=.18 && state.progress<.86?'肘部轨迹':'掌根压稳',w*.75,h*.38,cue);
      }
    }
    return {
      draw,
      view(name,standing) { [az,el]=(standing?standingPresets:cameraPresets)[name];zoom=1; },
      orbit(dx,dy) { az-=dx*.010;el=clamp(el+dy*.009,.035,1.18); },
      zoom(delta) { zoom=clamp(zoom+delta,.68,1.38); }
    };
  }
  window.PushupScene = { setup };
})();
