// const path = require("path");
const runApplescript = require("run-applescript");
const path = require("path");
const jsxPath = path.resolve("./createAi.jsx");
const fs = require("fs");
const getToday = require("./utils").getToday;
const { createFileAndFolder, uploadFiles } = require("./googleDrive");
const { getTransaction, updateTransactions } = require("./db");
const {
  getProdcutNameMakingExcel,
  getIllustratorFileName,
  insertSheetData,
} = require("./googleSheet");
const createIllustratorFile = require("./illustrator");

async function manufacuturing() {
  try {
    const transactions = await Promise.resolve(getTransaction("paid"));
    //해당 status에 해당하는 주문정보 받아오기.

    // 1. 거래 데이터 받아오기
    //2. transactions 데이터 가공하기
    const trans_ill = await Promise.all(
      transactions.map(async (transaction) => {
        const excelData = await Promise.resolve(getProdcutNameMakingExcel(transaction));
        const illusteData = await Promise.resolve(
          getIllustratorFileName({ transaction, excelData })
        );
        return { ...transaction, illustrator: illusteData };
      })
    );

    //3. 구글 드라이브 및 로컬 파일 경로 생성하기.
    const { transactions: trans_ill_drive, combinedSheetId } = await Promise.resolve(
      createFileAndFolder(trans_ill)
    );

    //4. 구글 스프레드시트 데이터 삽입하기.
    await Promise.resolve(insertSheetData(trans_ill_drive, combinedSheetId));

    const localPathAndFolderIds = await Promise.resolve(createIllustratorFile(trans_ill_drive));

    const uploadedFileIds = await Promise.resolve(uploadFiles(localPathAndFolderIds));

    // update Transaction. (status preparing)
    const updatedTransactions = await Promise.resolve(updateTransactions(transactions));

    console.log("거래 상태변경 완료");
    //5. 일러스트레이터 파일 돌리기.
  } catch (err) {
    console.error(err);
  }
}

manufacuturing();
