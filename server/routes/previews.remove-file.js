// server/routes/previews.remove-file.js
const fs=require("fs"),path=require("path");
const safePath=p=>path.join(process.cwd(), String(p||"").replace(/^\/+/, "").replace(/\.\./g,""));
exports.removeFile=(req,res)=>{ try{
  const { path:pp, file } = req.body||{}; if(!pp||!file) return res.status(400).json({ok:false,error:"bad args"});
  fs.unlinkSync(path.join(safePath(pp), file)); res.json({ ok:true });
}catch(e){ res.status(500).json({ok:false,error:e?.message||"delete failed"});} };
