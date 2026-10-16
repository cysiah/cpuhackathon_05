/* Floorplates section: the tool lives in app/ and runs in an iframe. It posts its own height so the frame fits it. */
(function () {
  "use strict";
  var frame = document.getElementById("floor-tool");
  if (!frame) return;
  window.addEventListener("message", function (e) {
    if (e.source !== frame.contentWindow || !e.data || e.data.type !== "floormap-height") return;
    frame.style.height = Math.max(600, Math.ceil(e.data.h) + 4) + "px";
  });
})();
