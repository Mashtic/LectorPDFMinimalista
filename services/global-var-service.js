
const globalVars = {
  pdfPath: null,
  currentPDF: null,
}

function getGlobalVar(key){
  return globalVars[key]
}


function setGlobalVar(key, value){
  if(globalVars[key] === undefined){
    throw `Error: Setting non-existing global variable:${key}`
  }

  globalVars[key] = value
}

module.exports = {getGlobalVar, setGlobalVar}
