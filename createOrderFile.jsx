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

  var originWidth = design.width;
  var originHeight = design.height;

  design.width = square.width;

  var isPhoneCase =
    templateFile.indexOf("하드케이스") !== -1 || templateFile.indexOf("젤리케이스") !== -1;

  if (isPhoneCase) {
    design.height = (originHeight / originWidth) * square.width;
  } else {
    design.height = square.height;
  }

  design.position = square.position;
  if (isPhoneCase) {
    design.position = [
      design.position[0],
      design.position[1] + (design.height - square.height) / 2,
    ];
    //빼면 일러스트에서 내려간다.
  }

  //폰케이스일 경우, 포지션이 완전히 같게 되지 않는다. 크기가 동일하지 않기 때문에. 해당 부분 고칠 것.

  if (saveOption === "PMSColor") {
    var copied = design.duplicate();

    copied.name = "copied";

    var traced = copied.trace();

    traced.tracing.tracingOptions.threshold = 249.999;
    //하얀색보다 큰 것을 전부 스캔.
    traced.tracing.tracingOptions.ignoreWhite = true;
    //ignoreWhite는 투명 영역을 포함하지 않는 것이다.
    traced.tracing.tracingOptions.tracingMode = TracingModeType.TRACINGMODEBLACKANDWHITE;
    //별색 start
    var pmfGroup = traced.tracing.expandTracing();

    var spotCount = document.spots.length;

    if (spotCount > 0) {
      document.spots.removeAll();
    }

    var newSpot = document.spots.add();
    newSpot.name = "RDG_WHITE";

    var pmfColor = new CMYKColor();
    pmfColor.black = 25;
    pmfColor.cyan = 25;
    pmfColor.magenta = 25;
    pmfColor.yellow = 25;

    // newSpot.name = "RDG_WHITE";
    newSpot.colorType = ColorModel.SPOT;
    newSpot.color = pmfColor;

    var newSpotColor = new SpotColor();
    newSpotColor.spot = newSpot;

    //화이트 영역 부분
    pmfGroup.name = "별색 처리";

    for (var i = 0; i < pmfGroup.pathItems.length; i++) {
      pmfGroup.pathItems[i].filled = true;
      pmfGroup.pathItems[i].fillColor = newSpotColor;
    }

    var pmfColorGroup = document.groupItems.add();
    pmfGroup.moveToBeginning(pmfColorGroup);

    //invertedColor tracing
    var invertedDesign = design.duplicate();
    invertedDesign.name = "별색 전환";
    invertedDesign.embed();

    app.activeDocument.pathItems = invertedDesign;
    app.executeMenuCommand("Colors6");

    var target = document.pageItems.getByName("별색 전환");
    var traced = target.trace();
    traced.tracing.tracingOptions.threshold = 249.999;
    traced.tracing.tracingOptions.ignoreWhite = true;
    traced.tracing.tracingOptions.tracingMode = TracingModeType.TRACINGMODEBLACKANDWHITE;

    var invertedPmfGroup = traced.tracing.expandTracing();

    invertedPmfGroup.name = "별색 처리_색상변환";

    for (var i = 0; i < invertedPmfGroup.pathItems.length; i++) {
      invertedPmfGroup.pathItems[i].filled = true;
      invertedPmfGroup.pathItems[i].fillColor = newSpotColor;
    }

    invertedPmfGroup.moveToBeginning(pmfColorGroup);
    pmfColorGroup.moveToBeginning(group);
    //별색 end
  }

  design.moveToBeginning(group);
  square.moveToBeginning(group);
  //move to group

  group.clipped = true;

  design.embed();

  var resultFilePath;
  if (saveOption === "png") {
    var exportOptions = new ExportOptionsPNG24();
    var type = ExportType.PNG24;
    var fileSpec = new File(newFilePath);
    var resultFilePath = newFilePath + ".png";
    document.exportFile(fileSpec, type, exportOptions);
  } else {
    document.saveAs(new File(newFilePath));
    var resultFilePath = newFilePath + ".ai";
  }

  document.close(SaveOptions.DONOTSAVECHANGES);

  return resultFilePath;
}
