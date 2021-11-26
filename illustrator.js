const runApplescript = require("run-applescript");
const path = require("path");
const jsxPath = path.resolve("./createOrderFile.jsx");
const _ = require("lodash");

async function createIllustratorFile(trans_ill_drive) {
  const only_illustrator = trans_ill_drive.map((trans) => trans.illustrator);
  console.log(only_illustrator);

  const illustrator_data = only_illustrator.reduce((acc, cur) => {
    const arrayInarrayToArray = cur.imagePath_aiFileNames.map((data) => {
      return {
        ..._.pick(cur, [
          "templateName",
          "factory",
          "saveOption",
          "localFolder_Save_Path",
          "todayFolder_OrderFolder_Id",
        ]),
        imagePath: data.imagePath,
        aiFileName: data.aiFileName,
      };
    });
    acc.push(...arrayInarrayToArray);
    return acc;
  }, []);

  let madeFiles = [];

  for (let i in illustrator_data) {
    const data = illustrator_data[i];
    const templateFile = `${path.dirname(require.main.filename)}/template/${data.factory}/${
      data.templateName
    }.ai`;
    const newFilePath = `${data.localFolder_Save_Path}/${data.aiFileName}`;
    const imagePath = data.imagePath;
    const saveOption = data.saveOption;

    const aiNewFilePath = await runApplescript(
      `tell application "Adobe Illustrator" to do javascript "#include ${jsxPath}" with arguments {"${templateFile}", "${newFilePath}", "${imagePath}", "${saveOption}"}`
    );
    //로컬 ai 파일 저장경로 push
    madeFiles.push(aiNewFilePath);
  }

  illustrator_data.forEach((data, i) => {
    const localPath = `${data.localFolder_Save_Path}/${data.aiFileName}`;
    const madeLocalPath = `${madeFiles[i].split(".")[0]}`;
    if (localPath !== madeLocalPath) {
      console.log(
        "생성한 파일과 생성된 파일이 일치하지 않습니다. 일러스트 파일 제작 중 오류가 있습니다."
      );
    }
  });

  const result = illustrator_data.map((data, i) => {
    return {
      localSavePath: madeFiles[i],
      todayFolder_OrderFolder_Id: data.todayFolder_OrderFolder_Id,
    };
  });

  return result;
}

module.exports = createIllustratorFile;
