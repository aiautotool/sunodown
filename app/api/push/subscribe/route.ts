export const runtime='edge';

export async function POST(request:Request){
 try{const body=await request.json() as Record<string,unknown>;if(!body.installationId)return Response.json({error:'Thiếu installationId.'},{status:400});return Response.json({ok:true,status:'provisioning',message:'Notification permission enabled. Push subscription persistence will activate after D1/VAPID provisioning.'},{status:202})}catch{return Response.json({error:'Dữ liệu notification không hợp lệ.'},{status:400})}
}

export async function DELETE(){return Response.json({ok:true})}
