var templateFile = arguments[0];
var newFilePath = arguments[1];
var imagePath = arguments[2];
var saveOption = arguments[3];

createOrderFile();
function createOrderFile() {
  var document = app.open(new File(templateFile));

  var group = document.groupItems.add();
  var square = document.pageItems.getByName("standard");

  var design = document.placedItems.add();
  design.file = new File(imagePath);
  design.width = square.width;
  design.height = square.height;
  design.position = square.position;

  if (saveOption === "PMSColor") {
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
  }

  design.moveToBeginning(group);
  square.moveToBeginning(group);
  //move to group

  group.clipped = true;

  design.embed();

  if (saveOption === "png") {
    var exportOptions = new ExportOptionsPNG24();
    var type = ExportType.PNG24;
    var fileSpec = new File(newFilePath);

    document.exportFile(fileSpec, type, exportOptions);
  } else {
    document.saveAs(new File(newFilePath));
  }

  document.close(SaveOptions.DONOTSAVECHANGES);

  return newFilePath;
}
