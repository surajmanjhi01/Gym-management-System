const mongoose= require('mongoose');
const counterSchema=new mongoose.Schema({
    tenantId:{type:mongoose.Schema.Types.ObjectId,ref:'Gym',required:true,index:true},
    seqType:{type:String,required:true},
    seq:{type:Number,default:0},
},
{timestamps:true}
);
counterSchema.index({tenantId:1,seqType:1},{unique:true});

counterSchema.statics.getNextSequence=async function (tenantId,seqType){
    const result =await this.findOneAndUpdate(
        {tenantId,seqType},
        {$inc:{seq:1}},
        {new:true,upsert:true}
    );
    return result.seq;  
};
module.exports=mongoose.model('Counter',counterSchema);