const { model, Schema, Model } = require("mongoose");

const productSchema = new Schema(
  {
    designerId: {
      type: Schema.Types.ObjectId,
      ref: "Designer",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: Object,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    models: {
      type: String,
    },
    detailModel: {
      type: String,
    },
    kind: {
      type: String,
    },
    ai: {
      type: Object,
    },
    image: {
      type: Object,
      required: true,
    },
    editedImage: {
      type: Object,
      required: true,
    },
    color: {
      type: Object,
      // primary color, sub colors
    },
    coin: {
      type: Number,
      default: 1,
    },
    visible: {
      type: Boolean,
      default: true,
    },
    updatePrice: {
      type: Date,
    },
    score: {
      type: Number,
      default: 0,
    },
    code: {
      type: String,
      required: true,
    },
    profit: {
      type: Number,
      required: true,
    },
    keywords: {
      type: Array,
    },
  },
  {
    timestamps: true,
  }
);

const Product = model("Product", productSchema);
module.exports = Product;
