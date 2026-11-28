/* Local PDF image placement. No signature credentials or document data leave the browser. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.OfferSigningCore=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const defaults=Object.freeze({
    signature:Object.freeze({x:39,y:72.5,w:15,h:5.5}),
    stamp:Object.freeze({x:49.5,y:79.4,w:28,h:4.6})
  });
  function outputName(name){
    if(typeof name!=='string'|| !/^[^\\/]+\.pdf$/i.test(name) || /[\x00-\x1f]/.test(name))
      throw Error('Choose a PDF with a valid filename.');
    return name.replace(/(\.pdf)$/i,'_signed$1');
  }
  function fit(box, page, image){
    const {x,y,w,h}=box, {width,height}=page;
    if(![x,y,w,h,width,height,image.width,image.height].every(Number.isFinite) ||
      x<0||y<0||w<=0||h<=0||x+w>100.000001||y+h>100.000001||
      width<=0||height<=0||image.width<=0||image.height<=0)
      throw Error('Placement must fit entirely within the page (0–100%).');
    const bw=width*w/100,bh=height*h/100;
    const scale=Math.min(bw/image.width,bh/image.height);
    const dw=image.width*scale,dh=image.height*scale;
    return {x:(page.x||0)+width*x/100+(bw-dw)/2,
      y:(page.y||0)+height-height*y/100-bh+(bh-dh)/2,width:dw,height:dh};
  }
  async function apply(pdfLib, bytes, assets, pageNumber, boxes){
    if(!Number.isInteger(pageNumber)||pageNumber<1) throw Error('Choose a valid page number.');
    const doc=await pdfLib.PDFDocument.load(bytes,{updateMetadata:false});
    const page=doc.getPages()[pageNumber-1];
    if(!page) throw Error('Selected page does not exist.');
    if(((page.getRotation().angle%360)+360)%360!==0)
      throw Error('Rotated page: normalize its orientation first.');
    const crop=page.getCropBox();
    const media=page.getMediaBox();
    if(crop.x<media.x-0.01||crop.y<media.y-0.01||crop.x+crop.width>media.x+media.width+0.01||crop.y+crop.height>media.y+media.height+0.01)
      throw Error('Unsupported page crop. Normalize the PDF first.');
    for(const kind of ['signature','stamp']){
      const asset=assets[kind];
      if(!asset||!asset.bytes) throw Error('Attach both a signature and a stamp.');
      const img=asset.type==='png'?await doc.embedPng(asset.bytes):
        asset.type==='jpeg'?await doc.embedJpg(asset.bytes):null;
      if(!img) throw Error('Only PNG and JPEG images are supported.');
      page.drawImage(img,fit(boxes[kind],crop,img));
    }
    return doc.save();
  }
  return {defaults,outputName,fit,apply};
});
