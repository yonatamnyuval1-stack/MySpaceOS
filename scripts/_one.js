const {app,BrowserWindow}=require('electron');
const fs=require('fs');const path=require('path');
const out=path.join(__dirname,'..','.tmp-theme-smoke','alive-multi.txt');
const id='os-bridge';
app.whenReady().then(async()=>{
  const preload=path.join(__dirname,'..','apps',id,'preload.js');
  const win=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,nodeIntegration:false}});
  try{
    await win.loadURL('data:text/html,<script>document.title=JSON.stringify({has:!!window.myApp,id:window.myApp&&window.myApp.moduleId,inv:!!(window.myApp&&window.myApp.invoke)})</script>');
    const raw=await win.webContents.executeJavaScript('document.title');
    fs.appendFileSync(out, id+' OK '+raw+'\n');
    app.exit(0);
  }catch(e){fs.appendFileSync(out, id+' ERR '+e+'\n'); app.exit(1);}
});
