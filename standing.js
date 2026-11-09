(function(root) {
  'use strict';
  const {add,sub,mul,dot,cross,unit,mix,clamp,sides} =
    typeof module === 'object' && module.exports ? require('./pose.js') : root.PushupPose;
  const UP = [0,1,0], DOWN = [0,-1,0], FRONT = [1,0,0], BACK = [-1,0,0], ACROSS = [0,0,1];
  const SIDE = (s) => [0,0,s];
  const rad = degrees => degrees * Math.PI / 180;
  const curve = x => .5 - .5*Math.cos(Math.PI*clamp(x,0,1));
  const pulse = t => t < .48 ? curve(t/.48) : t <= .60 ? 1 : 1-curve((t-.60)/.40);
  const plane = (v, axis) => unit(sub(v,mul(axis,dot(v,axis))));
  const extend = (origin,direction,length) => add(origin,mul(unit(direction),length));
  const legLength = [.429,.434], armLength = [.285,.265];
  const supportHeight = .64;

  function bendAt(start, end, toward, [first,second]) {
    const difference=sub(end,start), axis=unit(difference);
    const distance=clamp(Math.hypot(...difference), Math.abs(first-second)+.001, first+second-.0001);
    const along=(first*first - second*second + distance*distance)/(2*distance);
    const offset=Math.sqrt(Math.max(0,first*first-along*along));
    return add(add(start,mul(axis,along)),mul(plane(toward,axis),offset));
  }

  function pose(id, t, side=1, error='') {
    const alternating=id==='march';
    const d=pulse(alternating ? (t===1 ? 1 : (t*2)%1) : t);
    const active=alternating ? (t<.5?1:-1) : side;
    const flawed=error?d:0;
    let pitch=2, lean=0, twist=0, hip=[-.026,.936,0];
    let spread=.145;
    const isHinged=['singleRow','doubleRow','fly','kickback'].includes(id);
    if(isHinged) {
      hip=[-.235,.893,0];
      pitch=id==='singleRow'?66:id==='fly'?73:67;
      if(error==='heave') pitch-=29*flawed;
      if(error==='twist') twist=-active*.47*flawed;
    } else if(id==='rdl') {
      hip=[-.026-.253*d,.936-.066*d,0];
      pitch=2+64*d+(error==='round'?13*flawed:0);
    } else if(id==='squat') {
      hip=[-.025-.257*d,.936-.443*d,0];
      pitch=2+33*d;spread=.214;
    } else if(id==='lunge') {
      hip=[-.025-.221*d,.936-.397*d,0];
      pitch=3+14*d;
    } else if(id==='calf') {
      const dip=error==='kneeDip'?.15*flawed:0;
      hip=[-.026+.052*d,.936+.116*d-dip,0];
      pitch=2+20*dip;
    } else if(id==='knee'||id==='march') {
      hip=[-.025,.934,-.093*d*active];
    }
    if(error==='arch') pitch-=18*flawed;
    if(error==='sideLean') lean=.30*active*flawed;
    const axis=unit([Math.sin(rad(pitch)),Math.cos(rad(pitch)),lean]);
    let lateral=plane(ACROSS,axis);
    let forward=cross(axis,lateral);
    lateral=add(mul(lateral,Math.cos(twist)),mul(forward,Math.sin(twist)));
    forward=cross(axis,lateral);
    const shoulder=add(hip,mul(axis,.525));
    const neck=add(shoulder,mul(axis,.100));
    const headAxis=error==='round'?unit(add(axis,[.13,-.38*flawed,0])):axis;
    const head=add(neck,mul(headAxis,.115));
    const legs=sides.map(s=>{
      const legHip=add(hip,[0,0,.117*s]);
      let ankle=[0,.09,spread*s], toe=[.151,.030,(spread+.015)*s], knee;
      if(id==='singleRow'){
        const offset=s===active?-.16:.065;
        ankle=add(ankle,[offset,0,0]);toe=add(toe,[offset,0,0]);
      }
      if(id==='lunge' && s===active) {
        const step=1-Math.pow(1-d,3);
        const footLift=.18*Math.sin(Math.PI*step);
        toe=[.151-.735*step,.03+footLift,spread*s];
        ankle=[-.707*step,.09+.123*step+footLift,spread*s];
      }
      if(id==='calf') ankle=add(ankle,[.059*d,.116*d,0]);
      if((id==='knee'||alternating)&&s===active) {
        const restHip=[-.025,.934,.117*s];
        const restKnee=bendAt(restHip,ankle,[1,0,.14*s],legLength);
        const thigh=mix(unit(sub(restKnee,restHip)),[.98,-.14,.18*s],d);
        const shin=mix(unit(sub(ankle,restKnee)),[-.24,-.97,.045*s],d);
        knee=extend(legHip,thigh,legLength[0]);
        ankle=extend(knee,shin,legLength[1]);
        toe=add(ankle,[.151,-.060-.035*d,.015*s]);
      }
      if(!knee) {
        const target = error==='knees' && (id!=='lunge'||s!==active)
          ? [1,0,-1.24*flawed*s] : [1,0,.14*s];
        knee=bendAt(legHip,ankle,target,legLength);
      }
      return {hip:legHip,knee,ankle,toe};
    });

    const arms=sides.map(s=>{
      const out=mul(lateral,s);
      let anchor=add(shoulder,mul(out,.193));
      if(error==='shrug') anchor=add(anchor,[0,.095*flawed,0]);
      let upper=add(DOWN,mul(out,.20)), lower=add(DOWN,mul(out,.11));
      let weight=true, grip=FRONT, fixedWrist;
      switch(id) {
        case 'overhead': {
          const angle=rad(143*d);
          upper=add(axis,mul(out,-.17));
          lower=add(add(mul(axis,Math.cos(angle)),mul(forward,-Math.sin(angle))),mul(out,-.31));
          weight=false;
          break;
        }
        case 'kickback':
          upper=add(mul(axis,-1),mul(out,.10));
          if(error==='armSwing') upper=add(upper,[0,-.70*flawed,0]);
          lower=mix(DOWN,upper,.97*d);
          break;
        case 'singleRow':
          if(s!==active) {
            weight=false;
            fixedWrist=[.500,supportHeight+.041,.196*s];
            break;
          }
          // The working arm uses the same pulling path as the two-arm version.
        case 'doubleRow': {
          const angle=rad(78*d);
          upper=[-Math.sin(angle),-Math.cos(angle),.11*s];
          lower=[.10*d,-1,.03*s];
          break;
        }
        case 'fly': {
          const angle=rad(86*d);
          upper=[-.14*d,-Math.cos(angle),Math.sin(angle)*s];
          lower=add(upper,[.24,-.12,0]);
          if(error==='bend') lower=mix(lower,DOWN,.68*flawed);
          break;
        }
        case 'curl':
        case 'hammer': {
          const angle=rad(139*d+7);
          upper=add(mul(axis,-1),mul(out,.10));
          lower=add(add(mul(axis,-Math.cos(angle)),mul(forward,Math.sin(angle))),mul(out,.035));
          grip=id==='hammer'?unit(cross(unit(lower),out)):lateral;
          break;
        }
        case 'rdl':
          upper=[.08,-1,.13*s];lower=[.10,-1,.03*s];grip=ACROSS;
          break;
        case 'press': {
          const angle=rad(111*d-24);
          upper=add(add(mul(out,Math.cos(angle)),mul(axis,Math.sin(angle))),mul(forward,.33-.26*d));
          lower=add(axis,mul(out,-.20*d));grip=lateral;
          break;
        }
        case 'front':
        case 'lateral': {
          const angle=rad(84*d);
          const path=id==='front'?add(forward,mul(out,.08)):add(out,mul(forward,.25));
          upper=add(mul(path,Math.sin(angle)),mul(axis,-Math.cos(angle)));
          lower=add(upper,mul(forward,id==='front'?.12:.27));
          grip=id==='front'?lateral:unit(cross(unit(lower),forward));
          break;
        }
        case 'knee':
        case 'march':
          weight=false;
          upper=[s===active?-.19*d:.25*d,-1,.14*s];
          lower=[s===active?-.05*d:.52*d,-1,.04*s];
          break;
        case 'lunge':
          weight=false;
          upper=[.31*d,-1,.15*s];lower=[.60*d,-1,.02*s];
          break;
        case 'hold':
          weight=s===active;
          upper=add(DOWN,mul(out,s===active?.19:.15));
          lower=add(DOWN,mul(out,.06));
          break;
      }
      if(fixedWrist) return {
        shoulder:anchor, elbow:bendAt(anchor,fixedWrist,[-1,.1,.12*s],armLength),
        wrist:fixedWrist, weight, grip, support:true
      };
      const elbow=extend(anchor,upper,armLength[0]);
      const wrist=extend(elbow,lower,armLength[1]);
      return {shoulder:anchor,elbow,wrist,weight,grip};
    });
    const overhead=id==='overhead' ? {
      center:add(mix(arms[0].wrist,arms[1].wrist,.5),mul(add(mul(axis,1-d),mul(forward,-d)),.045)),
      axis:unit(add(mul(axis,Math.cos(rad(115*d))),mul(forward,-Math.sin(rad(115*d)))))
    } : null;
    const spineBow=error==='round'?mul(forward,-.091*flawed):null;
    return {hip,shoulder,neck,head,axis,headAxis,lateral,forward,legs,arms,active,overhead,spineBow,support:id==='singleRow'};
  }
  const api={pose,supportHeight};
  if(typeof module === 'object' && module.exports) module.exports=api;
  else root.StandingPose=api;
})(globalThis);
