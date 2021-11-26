const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const getToday = require("./utils").getToday;
const _ = require("lodash");
const { makeLocalTodayDir } = require("./utils");
const path = require("path");

const KEYFILEPATH = path.resolve("./gooledrive-321705-9b1f9f2f2dab.json");
// const KEYFILEPATH = "/Users/jinwook/Desktop/illustrator/gooledrive-321705-9b1f9f2f2dab.json";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const driveService = google.drive({ version: "v3", auth });
const sheetService = google.sheets({ version: "v4", auth });

async function checkAndMakeGoogleFile({ parentFolderId, fileName, fileType }) {
  //fileType: folder || file || sheet
  const getResponse = await driveService.files.list({
    q: `'${parentFolderId}' in parents and trashed=false`,
  });

  const googleFileType =
    fileType === "folder"
      ? "application/vnd.google-apps.folder"
      : fileType === "sheet"
      ? "application/vnd.google-apps.spreadsheet"
      : "application/vnd.google-apps.file";

  const isExistFile = getResponse.data.files.find(
    (file) => file.name === `${fileName}` && file.mimeType === googleFileType
  );

  let id;

  if (isExistFile) {
    id = isExistFile.id;
  } else {
    const fileMetaData = {
      name: `${fileName}`,
      mimeType: `${googleFileType}`,
      parents: [`${parentFolderId}`],
    };

    const fileResponse = await driveService.files.create({
      resource: fileMetaData,
      fields: "id",
    });
    id = fileResponse.data.id;
  }

  return { id: id, exist: isExistFile ? true : false, files: getResponse.data.files };
}

async function createFileAndFolder(transactions) {
  //transactions 전체를 받아옴.

  //합배송 체크.
  let number = 0;
  let combinedId = [];

  transactions = transactions.map((transaction) => {
    if (!transaction.commonId) {
      return transaction;
    }

    const combined_transaction = transactions.filter(
      (trans) => trans.commonId === transaction.commonId
    );
    //combined_transaction를 비교하였을 때 다른 제조사가 있다면, combinedId에 commonId 추가, number 추가.

    const combined_transaction_factories = combined_transaction.map(
      (trans) => trans.illustrator.factory
    );

    const isAnotherFactoryCombined =
      [...new Set(combined_transaction_factories)].length === 1 ? false : true;
    //factoryName 중복을 제거하고 그 수가 1 이상이면 combined 되어있는 것임.

    if (!isAnotherFactoryCombined) {
      return transaction;
    }
    //combined되어 있지 않다면 그냥 transaction 리턴

    if (!combinedId.includes(transaction.commonId)) {
      combinedId.push(transaction.commonId);
      number = number + 1;
    }
    return { ...transaction, combined: true, combinedNumber: number };
  });
  //factory가 다른 합배송 유무 판단.

  //1. list up
  const factoryName_folderId = transactions.map((transaction) => {
    return {
      factoryName: transaction.illustrator.factory,
      folderId: transaction.illustrator.folderId,
    };
  });

  let today_factoryList = _.uniqBy(factoryName_folderId, "factoryName");

  const date = new Date();
  const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
  const today = getToday();

  //합배송이 있으면 합배송 엑셀 생성
  const sheetHead = ["주문 id", "배송 id", "이름", "주소", "번호", "배송 메시지", "파일명", "수량"];
  let combinedSheetId = null;

  if (transactions.find((transaction) => transaction.combined)) {
    const { id } = await Promise.resolve(
      checkAndMakeGoogleFile({
        parentFolderId: "1IP0RdBV8GDSWwY7ny92PfS8ZrItM-Nq9",
        fileName: today,
        fileType: "sheet",
      })
    );
    combinedSheetId = id;
    await sheetService.spreadsheets.values.append({
      spreadsheetId: combinedSheetId,
      range: "Sheet1!A:I",
      valueInputOption: "RAW",
      resource: {
        values: [sheetHead],
      },
    });
  }

  //2. 리스트별로 월별 폴더가 있는지 확인, 없으면 생성
  today_factoryList = await Promise.all(
    today_factoryList.map(async (factoryInfo) => {
      const { id: thisMonthFolderId } = await Promise.resolve(
        checkAndMakeGoogleFile({
          parentFolderId: factoryInfo.folderId,
          fileName: month,
          fileType: "folder",
        })
      );

      return { ...factoryInfo, thisMonthFolderId };
    })
  );

  //3. 리스트별로 월별 엑셀이 있는지 확인, 없으면 생성

  today_factoryList = await Promise.all(
    today_factoryList.map(async (factoryInfo) => {
      const {
        id: thisMonthExcelId,
        exist: isThisMonthExcelExist,
        files: thisMonthFolderFiles,
      } = await Promise.resolve(
        checkAndMakeGoogleFile({
          parentFolderId: factoryInfo.thisMonthFolderId,
          fileName: `${month} 발주 내역`,
          fileType: "sheet",
        })
      );

      if (!isThisMonthExcelExist) {
        await sheetService.spreadsheets.values.append({
          spreadsheetId: thisMonthExcelId,
          range: "Sheet1!A:I",
          valueInputOption: "RAW",
          resource: {
            values: [[...sheetHead, "주문일"]],
          },
        });
      }

      //4. 업체 리스트별로 일별 폴더 생성
      const isExistTodayFolder = thisMonthFolderFiles.find(
        (file) => file.name === `${today}` && file.mimeType === "application/vnd.google-apps.folder"
      );

      if (isExistTodayFolder) {
        console.log("오늘 날짜 폴더가 이미 존재합니다. 2번 이상 실행한 이유를 확인하세요.");
      }

      //동일한 파일을 또 생성하는게 에러관리차원에서 나을 것 같아 이렇게 코드를 작성함.
      const folderMetaData = {
        name: `${today}`,
        mimeType: "application/vnd.google-apps.folder",
        parents: [`${factoryInfo.thisMonthFolderId}`],
      };

      const folderResponse = await driveService.files.create({
        resource: folderMetaData,
        fields: "id",
      });

      const todayFolderId = folderResponse.data.id;

      //일별 폴더 내 발주 파일 폴더 생성
      const todayFolderMetaData = {
        name: "발주 파일",
        mimeType: "application/vnd.google-apps.folder",
        parents: [`${todayFolderId}`],
      };

      const todayFolderResponse = await driveService.files.create({
        resource: todayFolderMetaData,
        fields: "id",
      });

      const todayFolder_OrderFolder_Id = todayFolderResponse.data.id;
      //일별 폴더 내 발주 내역 시트 생성
      const todaySheetMetaData = {
        name: "발주 내역",
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [`${todayFolderId}`],
      };

      const todaySheetResponse = await driveService.files.create({
        resource: todaySheetMetaData,
        fields: "id",
      });

      const todayFolder_OrderSheet_Id = todaySheetResponse.data.id;

      await sheetService.spreadsheets.values.append({
        spreadsheetId: todayFolder_OrderSheet_Id,
        // range: "Sheet1",
        range: "Sheet1!A:H",
        valueInputOption: "RAW",
        resource: {
          values: [sheetHead],
        },
      });

      // 각 업체별로 합배송을 현재는 지원하지 않을 예정.
      // 합배송 프로세스가 완벽하게 짜여지고, 수량이 확보되면 그 떄 이 시스템 오픈.

      // await sheetService.spreadsheets.batchUpdate({
      //   resource: {
      //     requests: [
      //       {
      //         addSheet: {
      //           properties: {
      //             title: "합배송",
      //           },
      //         },
      //       },
      //     ],
      //   },
      //   spreadsheetId: todayFolder_OrderSheet_Id,
      // });
      // //batch update로 sheet 생산해야함.

      // await sheetService.spreadsheets.values.append({
      //   spreadsheetId: todayFolder_OrderSheet_Id,
      //   // range: "Sheet1",
      //   range: "합배송!A:H",
      //   valueInputOption: "RAW",
      //   resource: {
      //     values: [sheetHead],
      //   },
      // });

      // 로컬 파일 생성
      const localFolder_Save_Path = makeLocalTodayDir(factoryInfo.factoryName);
      console.log("구글 드라이브 및 로컬 파일경로 생성 완료");
      return {
        ...factoryInfo,
        thisMonthExcelId,
        todayFolder_OrderFolder_Id,
        todayFolder_OrderSheet_Id,
        localFolder_Save_Path,
      };
    })
  );

  const result = transactions.map((transaction) => {
    const factoryData = today_factoryList.find(
      (factoryInfo) => factoryInfo.factoryName === transaction.illustrator.factory
    );

    const factoryIdAndPath = _.pick(factoryData, [
      "thisMonthExcelId",
      "todayFolder_OrderFolder_Id",
      "todayFolder_OrderSheet_Id",
      "localFolder_Save_Path",
    ]);

    return { ...transaction, illustrator: { ...transaction.illustrator, ...factoryIdAndPath } };
  });
  return { transactions: result, combinedSheetId };
  //transaction 데이터에 값을 넣어줄 것.
}

async function uploadFiles(localPathAndFolderIds) {
  const uploadFileIds = await Promise.all(
    localPathAndFolderIds.map(async (localpath_folderId) => {
      const uploadLocalFile = fs.createReadStream(`${localpath_folderId.localSavePath}`);
      const media = {
        mimeType: "application/postscript",
        body: uploadLocalFile,
      };

      const fileMetaData = {
        name: `${localpath_folderId.localSavePath.split("/").pop()}`,
        parents: [`${localpath_folderId.todayFolder_OrderFolder_Id}`],
      };

      const response = await driveService.files.create({
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

  //ai 파일 읽기.
  console.log("파일 업로드 완료");
  return uploadFileIds;
}

async function createAndUploadFile(dirname) {
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

module.exports = { createAndUploadFile, createFileAndFolder, uploadFiles };
//createAndUploadFIle(auth);
