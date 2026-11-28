const {test}=require('node:test');
const assert=require('node:assert/strict');
const {outputName,fit,defaults}=require('../public/js/offer-signing-core.js');
test('offer names retain original filename and extension, reject path segments',()=>{
  assert.equal(outputName('Offer - أحمد.pdf'),'Offer - أحمد_signed.pdf');
  assert.equal(outputName('Offer.PDF'),'Offer_signed.PDF');
  assert.throws(()=>outputName('../offer.pdf'));
  assert.throws(()=>outputName('offer.docx'));
});
test('image placement uses top-left page percentages and preserves aspect ratio',()=>{
  const r=fit({x:10,y:20,w:40,h:20},{x:5,y:10,width:600,height:800},{width:200,height:100});
  assert.deepEqual(r,{x:65,y:510,width:240,height:120});
  for(const b of Object.values(defaults)){
    const q=fit(b,{width:595,height:842},{width:200,height:100});
    assert.ok(q.x>=0&&q.y>=0&&q.x+q.width<=595&&q.y+q.height<=842);
  }
  assert.throws(()=>fit({x:95,y:10,w:10,h:10},{width:595,height:842},{width:1,height:1}));
});
