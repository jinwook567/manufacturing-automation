const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const getToday = require("./utils").getToday;

const KEYFILEPATH = "/Users/jinwook/Desktop/illustrator/gooledrive-321705-9b1f9f2f2dab.json";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

async function createAndUploadFile(dirname) {
  const driveService = google.drive({ version: "v3", auth });

  const today = getToday();

  let folderMetaData = {
    name: today,
    mimeType: "application/vnd.google-apps.folder",
    parents: ["1WQE7fmckOpvg_yMS5Q4Ld2-Q0fH6aB7r"],
  };

  let folderResponse = await driveService.files.create({
    resource: folderMetaData,
    fields: "id",
  });
  //folder 만들기

  let fileMetaData = {
    name: "fileName",
    // parents: ["1WQE7fmckOpvg_yMS5Q4Ld2-Q0fH6aB7r"],
    parents: [folderResponse.data.id],
    // folder를 만들고 folder Id를 받아서 거기다가 만든다.
  };

  //폴더를 읽고 map으로 올려주기
  const uploadFolder = fs.readdirSync(dirname);
  const result = await Promise.all(
    uploadFolder.map(async (file) => {
      const uploadFile = fs.createReadStream(`${dirname}/${file}`);
      let media = {
        mimeType: "application/postscript",
        body: uploadFile,
      };

      let response = await driveService.files.create({
        resource: fileMetaData,
        media: media,
        fields: "id",
      });

      if (response.status === 200) {
        console.log("file Created Id", response.data.id);
      }
      return response.data.id;
    })
  );
  return result;
  //ai 파일 읽기.
}

module.exports = createAndUploadFile;
//createAndUploadFIle(auth);
