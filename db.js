const Transaction = require("./Transaction");
const mongoose = require("mongoose");
const Product = require("./Product");

async function getTransaction(status) {
  const db =
    "mongodb+srv://kyu_young:WaByPiHh7Wtmk5we@we2d.tsqtt.mongodb.net/we2d?retryWrites=true&w=majority";
  mongoose
    .connect(db, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    })
    .then(() => {
      console.log("Connected");
    });

  const transactions = await Transaction.find({ status: status })
    .sort({ createdAt: -1 })
    .select("-iamPortData")
    .populate("productId");

  return transactions.map((transaction) => transaction.toJSON());
}

async function updateTransactions(transactions) {
  const result = await Promise.all(
    transactions.map(async (transaction) => {
      const updateTransaction = await Transaction.findByIdAndUpdate(transaction._id, {
        status: "preparing",
      });
      return updateTransaction;
    })
  );
  return result;
}

module.exports = { getTransaction, updateTransactions };
