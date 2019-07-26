define(['jquery', './vector', './buffer', './text!./main.html', 'require'], function($, Vector2, CircularBuffer, menuText, requireJs) {
    function createContext(document) {
        (function() {
            let images = document.querySelectorAll("img");
            for (let i = 0; i < images.length; i++) {
                let splt = images[i].src.split("/");
                let src = splt[splt.length - 1];
                let newSrc = requireJs.toUrl('./' + src);
                images[i].src = newSrc;
            }

            let objs = document.querySelectorAll("object");
            for (let i = 0; i < objs.length; i++) {
                let splt = objs[i].data.split("/");
                let src = splt[splt.length - 1];
                let newSrc = requireJs.toUrl('./' + src);
                objs[i].data = newSrc;
            }
        })();
        
        var canvas = document.querySelector("canvas");
        var ctx = canvas.getContext("2d");
        var autosave = null;
        var autosaveTimer = null;

        /** Scaling of the canvas's internal resolution */
        var scale = 2;
        const min_dist = 7;
        const eraser_scale = 3;
        const min_width = 2;
        const max_width = 20;
        const autosave_timeout = 1000;

        const canvas_width = 2205;
        const aspect = 1.75;

        /** Width of the pen stroke */
        var width = 10;
        var color = "rgba(0.0,0.0,0.0,1.0)";
        /** The buffer of points for each current touch */
        var touches = {};
        /** If this device has a stylus, then don't recognise normal touch inputs. */
        var stylusEnabled = false;
        /** Current selected tool */
        var curTool = null;

        var colorSvg = document.querySelector("[setting=color]").children[1];
        var colorCircle = null;
        var widthSvg = document.querySelector(".width-preview");
        var widthLine = null;

        var eraserCircle = document.querySelector(".eraser-circle");
        hideEraserCircle();

        colorSvg.addEventListener("load", function() {
            colorCircle = colorSvg.getSVGDocument().getElementById("color-circle");
            setWidthSetting(parseFloat(widthSlider.value));
        });
        widthSvg.addEventListener("load", function() {
            widthLine = widthSvg.getSVGDocument().getElementById("width");
            setWidthSetting(parseFloat(widthSlider.value));
        });
        let onTryLoad = function() {
            try {
                colorCircle = colorSvg.getSVGDocument().getElementById("color-circle");
                widthLine = widthSvg.getSVGDocument().getElementById("width");
                setWidthSetting(parseFloat(widthSlider.value));
            } catch {}
        };
        window.addEventListener("load", onTryLoad);
        onTryLoad();

        class DrawingPoint {
            constructor(event) {
                let rect = canvas.getBoundingClientRect();
                this.x = (event.clientX - rect.left) * scale;
                this.y = (event.clientY - rect.top) * scale;
                this.origX = this.x;
                this.origY = this.y;

                if ('webkitForce' in event) {
                    this.pressure = event.webkitForce;
                } else if ('pressure' in event) {
                    this.pressure = event.pressure;
                } else if ('force' in event) {
                    this.pressure = event.force;
                } else {
                    this.pressure = 1.0;
                }
            }

            toVec() {
                return new Vector2(this.x, this.y);
            }

            toOrigVec() {
                return new Vector2(this.origX, this.origY);
            }

            copy(other) {
                this.x = other.x;
                this.y = other.y;
                this.pressure = other.pressure;
            }
        }

        /**
         * For-all function for the touch list interface.
         * @param f Function callback that takes as arguments the touch, the touch identifier, and the
         * index into the touch list.
         */
        try {
            /* TouchList will not be defined for devices w/o touch capabilities */
            TouchList.prototype.forAll = function(f) {
                for (let i = 0; i < this.length; i++) {
                    let touch = this[i];
                    let id = touch.identifier;
                    f(touch, id, i);
                }
            }
        } catch {}

        /**
         * Evaluate a cubic hermite spline at a certain time value.
         * @param t Time, scalar between 0 and 1.
         * @param pt1 {Vector2} Starting point
         * @param tan1 {Vector2} Tangent at the starting point
         * @param pt2 {Vector2} Ending point
         * @param tan2 {Vector2} Tangent at the ending point
         * @returns {Vector2} the hermite spline evaluated at the specified time.
         */
        function evalHermite(t, pt1, tan1, pt2, tan2) {
            if (t <= 0) {
                return pt1;
            } else if (t >= 1) {
                return pt2;
            }

            let t3 = t * t * t;
            let t2 = t * t;
            let p0 = pt1.multiply(2 * t3 - 3 * t2 + 1);
            let m0 = tan1.multiply(t3 - 2 * t2 + t);
            let p1 = pt2.multiply(-2 * t3 + 3 * t2);
            let m1 = tan2.multiply(t3 - t2);
            return p0.add(m0).add(p1.add(m1));
        }

        /**
         * Draw a variable width cubic hermite spline.  The width values are linearly interpolated.
         * @param pt1 {Vector2} Starting point
         * @param tan1 {Vector2} Tangent at the starting point
         * @param w1 {number} Starting width
         * @param pt2 {Vector2} Ending point
         * @param tan2 {Vector2} Tangent at the ending point
         * @param w2 {number} Ending width
         */
        function drawVariableWidthHermite(ctx, pt1, tan1, w1, pt2, tan2, w2) {
            let pts = Math.max(1, Math.ceil(Math.sqrt(pt2.subtract(pt1).length())));
            for (let i = 0; i < pts; i++) {
                let t = (i / pts);
                let tn = ((i+1) / pts);
                let tm = (t + tn) / 2;
                let st = evalHermite(t, pt1, tan1, pt2, tan2);
                let end = evalHermite(tn, pt1, tan1, pt2, tan2);
                
                ctx.beginPath();
                ctx.moveTo(st.x, st.y);
                ctx.lineTo(end.x, end.y);
                ctx.lineWidth = (w1 * (1 - tm)) + (w2 * tm);
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        /**
         * Evaluate a quadratic bezier curve at a certain time value.
         * @param t Time, scalar between 0 and 1.
         * @param ctrl {Vector2} Control point
         * @param pt1 {Vector2} Starting point
         * @param pt2 {Vector2} Ending point
         * @returns {Vector2} the bezier curve evaluated at the specified time.
         */
        function evalBezier(t, ctrl, pt1, pt2) {
            if (t <= 0) {
                return pt1;
            } else if (t >= 1) {
                return pt2;
            }
            
            let invt = 1.0 - t;
            let lhs = pt1.multiply(invt).add(ctrl.multiply(t)).multiply(invt);
            let rhs = ctrl.multiply(invt).add(pt2.multiply(t)).multiply(t);
            return lhs.add(rhs);
        }

        /**
         * Draw a variable width quadratic bezier curve.  The width values are linearly interpolated.
         * @param ctrl {Vector2} Control point
         * @param pt1 {Vector2} Starting point
         * @param w1 {number} Starting width
         * @param pt2 {Vector2} Ending point
         * @param w2 {number} Ending width.
         */
        function drawVariableWidthBezier(ctrl, pt1, w1, pt2, w2) {
            /* Evaluate the bezier at various points to make a smoother line,
               and because html5 canvas doesn't allow for width interpolation. */
            let pts = Math.max(1, Math.ceil(Math.sqrt(pt2.subtract(pt1).length())));
            for (let i = 0; i < pts; i++) {
                let t = (i / pts);
                let tn = ((i+1) / pts);
                let tm = (t + tn) / 2;
                let st = evalBezier(t, ctrl, pt1, pt2);
                let end = evalBezier(tn, ctrl, pt1, pt2);
                
                ctx.beginPath();
                ctx.moveTo(st.x, st.y);
                ctx.lineTo(end.x, end.y);
                ctx.lineWidth = (w1 * (1 - tm)) + (w2 * tm);
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        /**
         * Get the width of the pen stroke as a function of the input pressure.
         * @param pressure Pressure input from the pen, should be normalized from [0, 1]
         * @returns pen width.
         */
        function getWidth(pressure) {
            switch (curTool) {
            case 'eraser':
                return width * eraser_scale * scale;
            default:
                return width * Math.pow(pressure, 0.75) * scale;
            }
        }

        /**
         * Draw points from a buffer of DrawingPoint objects.
         * @params buffer {CircularBuffer} Buffer of max size 3 filled with drawing points.
         */
        function drawFromBuffer(buffer) {
            if (curTool === 'pen') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = color;
                if (buffer.size == 2) {
                    /* Not enough points to interpolate, just draw a straight line */
                    let pt1 = buffer.at(0);
                    let pt2 = buffer.at(1);

                    let v1 = pt1.toVec();
                    let v2 = pt2.toVec();
                    let end = v1.mid(v2);
                    
                    drawVariableWidthBezier(v1.mid(end), v1, getWidth(pt1.pressure),
                                            end, getWidth(pt2.pressure));
                } else if (buffer.size == 3){
                    let pt1 = buffer.at(0);
                    let pt2 = buffer.at(1);
                    let pt3 = buffer.at(2);

                    let v1 = pt1.toVec();
                    let v2 = pt2.toVec();
                    let v3 = pt3.toVec();

                    drawVariableWidthBezier(v2, v1.mid(v2), getWidth((pt1.pressure + pt2.pressure) * 0.5),
                                            v2.mid(v3), getWidth((pt2.pressure + pt3.pressure) * 0.5));
                }
            } else if (curTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                let pt1 = buffer.at(-2);
                let pt2 = buffer.at(-1);
                
                let v1 = pt1.toVec();
                let v2 = pt2.toVec();
                drawVariableWidthBezier(v1.mid(v2), v1, getWidth(pt1.pressure),
                                        v2, getWidth(pt2.pressure));
            }
        }

        function showEraserCircle(width) {
            eraserCircle.style.display = "block";
            eraserCircle.style.width = (width * eraser_scale) + "px";
            eraserCircle.style.height = (width * eraser_scale) + "px";
        }

        function hideEraserCircle() {
            eraserCircle.style.display = "none";
        }

        function moveEraser(pt) {
            let rect = canvas.getBoundingClientRect();
            eraserCircle.style.top = (rect.top + pt.y / scale) + "px";
            eraserCircle.style.left = (rect.left + pt.x / scale) + "px";
        }

        function setWidthSetting(newWidth) {
            let scale = Math.sqrt(newWidth / 100.0);
            if (scale < 0.1) {
                scale = 0.1;
            }
            
            colorCircle.transform.baseVal.getItem(0).setScale(scale, scale);
            width = ((newWidth / 100) * (max_width - min_width)) + min_width;

            if (widthLine !== null) {
                widthLine.style.strokeWidth = (width / 4) + "px";
            }
        }

        function hideColorPopup() {
            document.querySelector("[popup=color]").classList.add("hidden");
        }

        /**
         * Handler for touch/mouse move events.
         * @param touch The touch or mouse event.
         * @param id The touch id, or string "mouse" if a mouse event.
         */
        function onMoveEvent(touch, id) {
            if (touches[id] !== undefined) {
                let buffer = touches[id];
                
                if (curTool === "eraser") {
                    let curr = new DrawingPoint(touch);
                    buffer.push(curr);
                    drawFromBuffer(buffer);
                    moveEraser(curr);
                } else {
                    let last = buffer.at(buffer.length - 1);
                    let curr = new DrawingPoint(touch);
                    if (last.toOrigVec().dist(curr.toVec()) < min_dist) {
                        last.copy(curr);
                    } else {
                        buffer.push(curr);
                        drawFromBuffer(buffer);
                    }
                }        
            }

            tryAutosave();
        }

        /**
         * Handler for touch/mouse start events.
         * @param touch The touch or mouse event.
         * @param id The touch id, or string "mouse" if a mouse event.
         */
        function onDownEvent(touch, id) {
            hideColorPopup();
            if (curTool === null) {
                return;
            }

            if ('touchType' in touch) {
                if (stylusEnabled && touch.touchType !== "stylus") {
                    return;
                }
                if (touch.touchType === "stylus") {
                    stylusEnabled = true;
                }
            }
            
            let newpt = new DrawingPoint(touch);
            touches[id] = new CircularBuffer(3);
            touches[id].push(newpt);
            
            if (curTool === "eraser") {
                showEraserCircle(width);
                moveEraser(newpt);
            }

            tryAutosave();
        }

        /**
         * Handler for touch/mouse up and cancel events.
         * @param touch The touch or mouse event.
         * @param id The touch id, or string "mouse" if a mouse event.
         */
        function onUpEvent(touch, id) {
            if (touches[id] !== undefined) {
                if (touches[id] !== undefined) {
                    drawFromBuffer(touches[id]);
                }
                touches[id] = undefined;

                if (curTool === "eraser") {
                    hideEraserCircle();
                }
            }
            tryAutosave();
        }

        function keepAspectRatio() {
            let rect = document.getBoundingClientRect();
            document.style.height = ((rect.width / aspect) + 40) + "px";
            let canvasRect = canvas.getBoundingClientRect();
            scale = canvas.width / canvasRect.width;
        }
        keepAspectRatio();
        setTimeout(keepAspectRatio, 500);
        document.ownerDocument.defaultView.addEventListener("resize", keepAspectRatio);
        
        /**
         * Resize the canvas to be the same size as the window.
         */
        function resizeCanvas() {
            let rect = document.getBoundingClientRect();
            
            canvas.width = canvas_width;
            canvas.height = canvas_width / aspect;
            canvas.style.width = "100%";
            canvas.style.height = "calc(100% - 40px)";
        }
        resizeCanvas();

        function tryAutosave() {
            clearAutosave();
            autosaveTimer = setTimeout(() => {
                if (autosave !== null) {
                    autosave();
                }
                autosaveTimer = null;
            }, autosave_timeout);
        }

        function clearAutosave() {
            if (autosaveTimer !== null) {
                clearTimeout(autosaveTimer);
            }
        }

        function loadImageFromUrl(url) {
            let image = new Image(1, 1);
            image.src = url;
            image.onload = function() {
                ctx.drawImage(image, 0, 0);
                autosave();
            }
        }
        
        document.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
        });
        
        /* Touch event handlers */
        canvas.addEventListener("touchstart", (ev) => {
            ev.preventDefault();    
            ev.changedTouches.forAll(onDownEvent);
        });
        canvas.addEventListener("touchmove", (ev) => {
            ev.preventDefault();
            ev.changedTouches.forAll(onMoveEvent);
        });
        canvas.addEventListener("touchend", (ev) => {
            ev.preventDefault();
            ev.changedTouches.forAll(onUpEvent);
        });
        canvas.addEventListener("touchcancel", (ev) => {
            ev.preventDefault();
            ev.changedTouches.forAll(onUpEvent);
        });

        /* Mouse event handlers */
        canvas.addEventListener("mousedown", (ev) => { onDownEvent(ev, "mouse"); });
        canvas.addEventListener("mousemove", (ev) => { onMoveEvent(ev, "mouse"); });
        canvas.addEventListener("mouseup", (ev) => { onUpEvent(ev, "mouse"); });
        document.addEventListener("mouseleave", (ev) => { onUpEvent(ev, "mouse"); });

        /* Set up all the controls */
        var buttons = document.getElementsByClassName("control");
        function deselectAllButtons() {
            for (let i = 0; i < buttons.length; i++) {
                buttons[i].classList.remove("selected");
            }
        }

        for (let i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener("mousedown", (ev) => {
                hideColorPopup();
                if (buttons[i].classList.contains("selected")) {
                    buttons[i].classList.remove("selected");
                    curTool = null;
                } else {
                    deselectAllButtons();
                    buttons[i].classList.add("selected");
                    curTool = buttons[i].getAttribute("control");
                }
            });
        }

        buttons[0].classList.add("selected");
        curTool = "pen";

        /* Set up the color picker */
        document.querySelector("[setting=color]").children[0].addEventListener("click", (ev) => {
            document.querySelector("[popup=color]").classList.toggle("hidden");
        });

        var circle_buttons = document.getElementsByClassName("circle");
        for (let i = 0; i < circle_buttons.length; i++) {
            let circ = circle_buttons[i];
            circ.addEventListener("mousedown", (ev) => {
                let col = circ.style.backgroundColor.toString();
                colorCircle.style.fill = col;
                widthLine.style.stroke = col;
                color = col;
                hideColorPopup();
            });
        }

        let widthSlider = document.querySelector("input[type=range]");
        widthSlider.addEventListener("input", (ev) => {
            setWidthSetting(parseFloat(widthSlider.value));
        });

        exports = {
            resize: resizeCanvas,
            canvas: canvas,
            context: ctx,
            getCanvasData: function() {
                return canvas.toDataURL();
            },
            setAutosaveHandler: function(handler) {
                autosave = handler;
            },
            loadImageFromUrl: loadImageFromUrl
        };
        
        return exports;
    }

    function initialise(container) {
        $(container).append($(menuText));
        let drawingContainer = $(container).find(".container")[0];
        return createContext(drawingContainer);
    }
    
    return {
        initialise: initialise
    };
});
