export const question=(prompt,options,answer,why)=>[prompt,options.split('|'),answer,why];
export function author(target,id,rule,examples,notice,first,second,task,model,extra='') {
 if(target[id])throw new Error('Duplicate lesson '+id);
 target[id]={rule,examples:examples.split('||').map(s=>s.split('~')),notice,questions:[first,second],task,model,extra};
}
export const checkpoint=(questions,task,model,rubric)=>({questions,task,model,rubric});
