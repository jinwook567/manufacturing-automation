// import { getToday } from "./utils";

var filePath = arguments[0];
var newFilePath = arguments[1];
var imagePath = arguments[2];
var templatePath = filePath + "/sampleFile.ai";
var templateFile = new File(templatePath);

createAi();

function createAi() {
  var document = app.open(templateFile);

  var group = document.groupItems.add();
  var square = document.pageItems.getByName("square");

  var design = document.placedItems.add();
  design.file = new File(imagePath);
  design.width = square.width;
  design.height = square.height;
  design.position = square.position;

  var copied = design.duplicate();
  copied.name = "copied";

  var traced = copied.trace();

  traced.tracing.tracingOptions.tracingMode = TracingModeType.TRACINGMODEGRAY;
  traced.tracing.tracingOptions.ignoreWhite = true;

  //별색 start
  var pmfGroup = traced.tracing.expandTracing();
  var pmfColor = new CMYKColor();

  pmfColor.black = 25;
  pmfColor.cyan = 25;
  pmfColor.magenta = 25;
  pmfColor.yellow = 25;

  pmfGroup.name = "별색 처리";

  for (var i = 0; i < pmfGroup.pathItems.length; i++) {
    pmfGroup.pathItems[i].filled = true;
    pmfGroup.pathItems[i].fillColor = pmfColor;
  }
  pmfGroup.moveToBeginning(group);
  //별색 end

  design.moveToBeginning(group);
  square.moveToBeginning(group);
  //move to group

  group.clipped = true;

  design.embed();

  // const newFilePath = filePath + "/result/" + today + "/buytech/" + newFileName;

  document.saveAs(new File(newFilePath));
  document.close();

  return filePath;
}

//   var myTextFrame = document.textFrames.add();
//   myTextFrame.position = [200, 200];
//   myTextFrame.contents = "Hello World!";

//   var docWidth = docRef.width;
//   var frameRef = docRef.textFrames[0];
//   frameRef.width = docWidth;
//   frameRef.rotate(30, undefined, undefined, true);
