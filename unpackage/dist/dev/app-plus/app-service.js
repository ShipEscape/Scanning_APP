if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type2, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type2, filename, ...args);
    } else {
      console[type2].apply(console, [...args, filename]);
    }
  }
  const API_BASE_URL = "http://192.168.137.1";
  const API_URLS = {
    TEST1: `${API_BASE_URL}/test1.php`,
    GET_DATA: `${API_BASE_URL}/test1.php`,
    GET_BATTERY_STATUS: `${API_BASE_URL}/test1.php`,
    GET_ALARMS_LOG: `${API_BASE_URL}/test1.php`,
    FIRE_MONITOR: `${API_BASE_URL}/test1.php`,
    GET_ROOM_MAP: `${API_BASE_URL}/room_map_api.php`,
    GET_ROOM_CODES: `${API_BASE_URL}/getRoomCodes.php`,
    PEOPLE_INFO: `${API_BASE_URL}/test1.php`,
    HANDLE_FALLBACK_GET_DATA: `${API_BASE_URL}/test1.php`,
    SUBMIT_ALARM: `${API_BASE_URL}/test1.php`,
    UPDATE_PROCESS_STATUS: `${API_BASE_URL}/test1.php`
  };
  function getLatestByRadarId(rows) {
    const map = /* @__PURE__ */ new Map();
    rows.forEach((row, index) => {
      const radarId = String((row == null ? void 0 : row.radar_id) || (row == null ? void 0 : row.device_code) || index);
      const currentTime = new Date((row == null ? void 0 : row.time) || (row == null ? void 0 : row.created_at) || 0).getTime() || 0;
      const existing = map.get(radarId);
      if (!existing) {
        map.set(radarId, { ...row, __sortTime: currentTime, __sourceIndex: index });
        return;
      }
      const existingTime = Number(existing.__sortTime) || 0;
      const existingIndex = Number(existing.__sourceIndex) || 0;
      if (currentTime > existingTime || currentTime === existingTime && index > existingIndex) {
        map.set(radarId, { ...row, __sortTime: currentTime, __sourceIndex: index });
      }
    });
    return Array.from(map.values()).sort((a, b) => (Number(b.__sortTime) || 0) - (Number(a.__sortTime) || 0)).map(({ __sortTime, __sourceIndex, ...row }) => row);
  }
  function normalizeTest1Rows(payload) {
    return Array.isArray(payload == null ? void 0 : payload.data) ? payload.data : [];
  }
  const _imports_0$1 = "/static/images/device-deploy.png";
  const _imports_1 = "/static/images/battery-monitor.png";
  const _imports_2 = "/static/images/fire-monitor.png";
  const _imports_3 = "/static/images/scan-icon.png";
  const _imports_4 = "/static/images/alarm-handle.png";
  const _imports_5 = "/static/images/alarm-log.png";
  const _imports_6 = "/static/images/ship-illustration.png";
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$8 = {
    data() {
      return {
        onlineDevices: 0,
        warningCount: 0,
        batteryReplaceCount: 0,
        apiBaseUrl: API_BASE_URL,
        isRefreshing: false,
        autoRefreshTimer: null
        // 新增：存储定时器ID，用于后续清除
      };
    },
    methods: {
      navigateTo(url) {
        uni.navigateTo({
          url,
          animationType: "slide-in-right",
          animationDuration: 300
        });
      },
      // 刷新数据：新增isManual参数（true=手动刷新，false=自动刷新）
      async refreshData(isManual = false) {
        this.isRefreshing = true;
        try {
          const success = await this.fetchDeviceData();
          if (!success) {
            uni.showToast({
              title: "刷新失败",
              icon: "none",
              duration: 1500
            });
            return;
          }
          if (isManual) {
            uni.showToast({
              title: "数据已更新",
              icon: "success",
              duration: 1500
            });
          }
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:179", "刷新数据失败:", error);
          uni.showToast({
            title: "刷新失败",
            icon: "none",
            duration: 1500
          });
        } finally {
          this.isRefreshing = false;
        }
      },
      // 从数据库获取数据（原代码不变）
      async fetchDeviceData() {
        try {
          const res = await uni.request({
            url: API_URLS.TEST1,
            method: "GET",
            timeout: 8e3
          });
          if (res.statusCode === 200 && res.data) {
            const source = getLatestByRadarId(normalizeTest1Rows(res.data));
            this.onlineDevices = source.length;
            this.warningCount = source.filter((item) => Number(item.Alarm) === 0 && Number(item.is_processed) === 0).length;
            this.batteryReplaceCount = source.filter((item) => Number(item.dl) < 20).length;
            return true;
          } else {
            formatAppLog("error", "at pages/index/index.vue:205", "获取设备数据失败:", res.data);
            return false;
          }
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:209", "请求异常:", error);
          return false;
        }
      },
      // 新增：初始化自动刷新（5秒/次）
      initAutoRefresh() {
        if (this.autoRefreshTimer) {
          clearInterval(this.autoRefreshTimer);
        }
        this.autoRefreshTimer = setInterval(() => {
          this.refreshData(false);
        }, 5e3);
      },
      // 新增：清除自动刷新定时器（避免内存泄漏）
      clearAutoRefresh() {
        if (this.autoRefreshTimer) {
          clearInterval(this.autoRefreshTimer);
          this.autoRefreshTimer = null;
        }
      }
    },
    onLoad() {
      this.refreshData(false);
      this.initAutoRefresh();
    },
    // 新增：页面隐藏时清除定时器（避免后台无效请求，节省资源）
    onHide() {
      this.clearAutoRefresh();
    },
    // 新增：页面重新显示时重启自动刷新（如从子页面返回后恢复自动更新）
    onShow() {
      this.initAutoRefresh();
    },
    // 新增：页面销毁时彻底清除定时器（防止内存泄漏）
    onUnload() {
      this.clearAutoRefresh();
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "status-card" }, [
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["status-item", { "pulse": $data.batteryReplaceCount > 0 }])
          },
          [
            vue.createElementVNode("view", { class: "status-icon battery-icon" }, [
              vue.createElementVNode("icon", {
                type: "battery-full",
                size: "36",
                color: "#e67e22"
              })
            ]),
            vue.createElementVNode("text", { class: "status-label" }, "电池更换数"),
            vue.createElementVNode(
              "text",
              {
                class: vue.normalizeClass(["status-value", { "orange": $data.batteryReplaceCount > 0, "normal": $data.batteryReplaceCount === 0 }])
              },
              vue.toDisplayString($data.batteryReplaceCount),
              3
              /* TEXT, CLASS */
            )
          ],
          2
          /* CLASS */
        ),
        vue.createElementVNode("view", { class: "status-item" }, [
          vue.createElementVNode("view", { class: "status-icon device-icon" }, [
            vue.createElementVNode("icon", {
              type: "signal",
              size: "36",
              color: "#3498db"
            })
          ]),
          vue.createElementVNode("text", { class: "status-label" }, "在线设备"),
          vue.createElementVNode(
            "text",
            { class: "status-value" },
            vue.toDisplayString($data.onlineDevices),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["status-item", { "pulse": $data.warningCount > 0 }])
          },
          [
            vue.createElementVNode("view", { class: "status-icon alarm-icon" }, [
              vue.createElementVNode("icon", {
                type: "warn",
                size: "36",
                color: "#e74c3c"
              })
            ]),
            vue.createElementVNode("text", { class: "status-label" }, "报警次数"),
            vue.createElementVNode(
              "text",
              {
                class: vue.normalizeClass(["status-value", { "red": $data.warningCount > 0, "normal": $data.warningCount === 0 }])
              },
              vue.toDisplayString($data.warningCount),
              3
              /* TEXT, CLASS */
            )
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createElementVNode("view", { class: "menu-title" }, "功能菜单"),
      vue.createElementVNode("view", { class: "function-grid" }, [
        vue.createElementVNode("view", {
          class: "function-card",
          onClick: _cache[0] || (_cache[0] = ($event) => $options.navigateTo("/pages/deviceDeployment/deviceDeployment"))
        }, [
          vue.createElementVNode("view", { class: "card-icon device-deploy-icon" }, [
            vue.createElementVNode("image", {
              src: _imports_0$1,
              mode: "widthFix",
              alt: "设备部署图标"
            })
          ]),
          vue.createElementVNode("view", { class: "card-content" }, [
            vue.createElementVNode("text", { class: "card-title" }, "设备部署"),
            vue.createElementVNode("text", { class: "card-desc" }, "管理船舶火灾监测设备部署位置与状态")
          ]),
          vue.createElementVNode("view", { class: "card-arrow" }, [
            vue.createElementVNode("text", null, ">")
          ])
        ]),
        vue.createElementVNode("view", {
          class: "function-card",
          onClick: _cache[1] || (_cache[1] = ($event) => $options.navigateTo("/pages/batteryMonitor/batteryMonitor"))
        }, [
          vue.createElementVNode("view", { class: "card-icon battery-monitor-icon" }, [
            vue.createElementVNode("image", {
              src: _imports_1,
              mode: "widthFix",
              alt: "电池状态监控图标"
            })
          ]),
          vue.createElementVNode("view", { class: "card-content" }, [
            vue.createElementVNode("text", { class: "card-title" }, "电池状态监控"),
            vue.createElementVNode("text", { class: "card-desc" }, "实时监测设备电池电量与健康状况")
          ]),
          vue.createElementVNode("view", { class: "card-arrow" }, [
            vue.createElementVNode("text", null, ">")
          ])
        ]),
        vue.createElementVNode("view", {
          class: "function-card",
          onClick: _cache[2] || (_cache[2] = ($event) => $options.navigateTo("/pages/fireMonitor/fireMonitor"))
        }, [
          vue.createElementVNode("view", { class: "card-icon fire-monitor-icon" }, [
            vue.createElementVNode("image", {
              src: _imports_2,
              mode: "widthFix",
              alt: "舱室火灾监控图标"
            })
          ]),
          vue.createElementVNode("view", { class: "card-content" }, [
            vue.createElementVNode("text", { class: "card-title" }, "舱室火灾监控"),
            vue.createElementVNode("text", { class: "card-desc" }, "实时监控各舱室火情与异常状况")
          ]),
          vue.createElementVNode("view", { class: "card-arrow" }, [
            vue.createElementVNode("text", null, ">")
          ])
        ]),
        vue.createElementVNode("view", {
          class: "function-card",
          onClick: _cache[3] || (_cache[3] = ($event) => $options.navigateTo("/pages/roomMap/roomMap"))
        }, [
          vue.createElementVNode("view", { class: "card-icon room-map-icon" }, [
            vue.createElementVNode("image", {
              src: _imports_3,
              mode: "widthFix",
              alt: "房间地图图标"
            })
          ]),
          vue.createElementVNode("view", { class: "card-content" }, [
            vue.createElementVNode("text", { class: "card-title" }, "房间地图"),
            vue.createElementVNode("text", { class: "card-desc" }, "查看各楼层房间分布、坐标边界与地图总览")
          ]),
          vue.createElementVNode("view", { class: "card-arrow" }, [
            vue.createElementVNode("text", null, ">")
          ])
        ]),
        vue.createElementVNode("view", {
          class: "function-card",
          onClick: _cache[4] || (_cache[4] = ($event) => $options.navigateTo("/pages/handleInfo/handleInfo"))
        }, [
          vue.createElementVNode("view", { class: "card-icon alarm-handle-icon" }, [
            vue.createElementVNode("image", {
              src: _imports_4,
              mode: "widthFix",
              alt: "报警信息处理图标"
            })
          ]),
          vue.createElementVNode("view", { class: "card-content" }, [
            vue.createElementVNode("text", { class: "card-title" }, "报警信息处理"),
            vue.createElementVNode("text", { class: "card-desc" }, "处理船舶火灾报警信息与处置流程")
          ]),
          vue.createElementVNode("view", { class: "card-arrow" }, [
            vue.createElementVNode("text", null, ">")
          ])
        ]),
        vue.createElementVNode("view", {
          class: "function-card",
          onClick: _cache[5] || (_cache[5] = ($event) => $options.navigateTo("/pages/processInfo_log/processInfo_log"))
        }, [
          vue.createElementVNode("view", { class: "card-icon alarm-log-icon" }, [
            vue.createElementVNode("image", {
              src: _imports_5,
              mode: "widthFix",
              alt: "报警信息日志图标"
            })
          ]),
          vue.createElementVNode("view", { class: "card-content" }, [
            vue.createElementVNode("text", { class: "card-title" }, "报警信息日志"),
            vue.createElementVNode("text", { class: "card-desc" }, "查看船舶火灾报警历史记录与统计")
          ]),
          vue.createElementVNode("view", { class: "card-arrow" }, [
            vue.createElementVNode("text", null, ">")
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "ship-illustration" }, [
        vue.createElementVNode("image", {
          src: _imports_6,
          mode: "widthFix",
          alt: "船舶示意图"
        })
      ]),
      vue.createElementVNode("view", { class: "footer" }, [
        vue.createElementVNode("text", { class: "copyright" }, "© 2023 智慧船舶系统 版权所有")
      ])
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__scopeId", "data-v-1cf27b2a"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/index/index.vue"]]);
  var runtime = { exports: {} };
  (function(module) {
    var runtime2 = function(exports) {
      var Op = Object.prototype;
      var hasOwn = Op.hasOwnProperty;
      var defineProperty = Object.defineProperty || function(obj, key, desc) {
        obj[key] = desc.value;
      };
      var undefined$1;
      var $Symbol = typeof Symbol === "function" ? Symbol : {};
      var iteratorSymbol = $Symbol.iterator || "@@iterator";
      var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
      var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";
      function define(obj, key, value) {
        Object.defineProperty(obj, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true
        });
        return obj[key];
      }
      try {
        define({}, "");
      } catch (err) {
        define = function(obj, key, value) {
          return obj[key] = value;
        };
      }
      function wrap(innerFn, outerFn, self, tryLocsList) {
        var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
        var generator = Object.create(protoGenerator.prototype);
        var context = new Context(tryLocsList || []);
        defineProperty(generator, "_invoke", { value: makeInvokeMethod(innerFn, self, context) });
        return generator;
      }
      exports.wrap = wrap;
      function tryCatch(fn, obj, arg) {
        try {
          return { type: "normal", arg: fn.call(obj, arg) };
        } catch (err) {
          return { type: "throw", arg: err };
        }
      }
      var GenStateSuspendedStart = "suspendedStart";
      var GenStateSuspendedYield = "suspendedYield";
      var GenStateExecuting = "executing";
      var GenStateCompleted = "completed";
      var ContinueSentinel = {};
      function Generator() {
      }
      function GeneratorFunction() {
      }
      function GeneratorFunctionPrototype() {
      }
      var IteratorPrototype = {};
      define(IteratorPrototype, iteratorSymbol, function() {
        return this;
      });
      var getProto = Object.getPrototypeOf;
      var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
      if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
        IteratorPrototype = NativeIteratorPrototype;
      }
      var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
      GeneratorFunction.prototype = GeneratorFunctionPrototype;
      defineProperty(Gp, "constructor", { value: GeneratorFunctionPrototype, configurable: true });
      defineProperty(
        GeneratorFunctionPrototype,
        "constructor",
        { value: GeneratorFunction, configurable: true }
      );
      GeneratorFunction.displayName = define(
        GeneratorFunctionPrototype,
        toStringTagSymbol,
        "GeneratorFunction"
      );
      function defineIteratorMethods(prototype) {
        ["next", "throw", "return"].forEach(function(method) {
          define(prototype, method, function(arg) {
            return this._invoke(method, arg);
          });
        });
      }
      exports.isGeneratorFunction = function(genFun) {
        var ctor = typeof genFun === "function" && genFun.constructor;
        return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
      };
      exports.mark = function(genFun) {
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
        } else {
          genFun.__proto__ = GeneratorFunctionPrototype;
          define(genFun, toStringTagSymbol, "GeneratorFunction");
        }
        genFun.prototype = Object.create(Gp);
        return genFun;
      };
      exports.awrap = function(arg) {
        return { __await: arg };
      };
      function AsyncIterator(generator, PromiseImpl) {
        function invoke(method, arg, resolve, reject) {
          var record = tryCatch(generator[method], generator, arg);
          if (record.type === "throw") {
            reject(record.arg);
          } else {
            var result = record.arg;
            var value = result.value;
            if (value && typeof value === "object" && hasOwn.call(value, "__await")) {
              return PromiseImpl.resolve(value.__await).then(function(value2) {
                invoke("next", value2, resolve, reject);
              }, function(err) {
                invoke("throw", err, resolve, reject);
              });
            }
            return PromiseImpl.resolve(value).then(function(unwrapped) {
              result.value = unwrapped;
              resolve(result);
            }, function(error) {
              return invoke("throw", error, resolve, reject);
            });
          }
        }
        var previousPromise;
        function enqueue(method, arg) {
          function callInvokeWithMethodAndArg() {
            return new PromiseImpl(function(resolve, reject) {
              invoke(method, arg, resolve, reject);
            });
          }
          return previousPromise = // If enqueue has been called before, then we want to wait until
          // all previous Promises have been resolved before calling invoke,
          // so that results are always delivered in the correct order. If
          // enqueue has not been called before, then it is important to
          // call invoke immediately, without waiting on a callback to fire,
          // so that the async generator function has the opportunity to do
          // any necessary setup in a predictable way. This predictability
          // is why the Promise constructor synchronously invokes its
          // executor callback, and why async functions synchronously
          // execute code before the first await. Since we implement simple
          // async functions in terms of async generators, it is especially
          // important to get this right, even though it requires care.
          previousPromise ? previousPromise.then(
            callInvokeWithMethodAndArg,
            // Avoid propagating failures to Promises returned by later
            // invocations of the iterator.
            callInvokeWithMethodAndArg
          ) : callInvokeWithMethodAndArg();
        }
        defineProperty(this, "_invoke", { value: enqueue });
      }
      defineIteratorMethods(AsyncIterator.prototype);
      define(AsyncIterator.prototype, asyncIteratorSymbol, function() {
        return this;
      });
      exports.AsyncIterator = AsyncIterator;
      exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
        if (PromiseImpl === void 0)
          PromiseImpl = Promise;
        var iter = new AsyncIterator(
          wrap(innerFn, outerFn, self, tryLocsList),
          PromiseImpl
        );
        return exports.isGeneratorFunction(outerFn) ? iter : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
      };
      function makeInvokeMethod(innerFn, self, context) {
        var state = GenStateSuspendedStart;
        return function invoke(method, arg) {
          if (state === GenStateExecuting) {
            throw new Error("Generator is already running");
          }
          if (state === GenStateCompleted) {
            if (method === "throw") {
              throw arg;
            }
            return doneResult();
          }
          context.method = method;
          context.arg = arg;
          while (true) {
            var delegate = context.delegate;
            if (delegate) {
              var delegateResult = maybeInvokeDelegate(delegate, context);
              if (delegateResult) {
                if (delegateResult === ContinueSentinel)
                  continue;
                return delegateResult;
              }
            }
            if (context.method === "next") {
              context.sent = context._sent = context.arg;
            } else if (context.method === "throw") {
              if (state === GenStateSuspendedStart) {
                state = GenStateCompleted;
                throw context.arg;
              }
              context.dispatchException(context.arg);
            } else if (context.method === "return") {
              context.abrupt("return", context.arg);
            }
            state = GenStateExecuting;
            var record = tryCatch(innerFn, self, context);
            if (record.type === "normal") {
              state = context.done ? GenStateCompleted : GenStateSuspendedYield;
              if (record.arg === ContinueSentinel) {
                continue;
              }
              return {
                value: record.arg,
                done: context.done
              };
            } else if (record.type === "throw") {
              state = GenStateCompleted;
              context.method = "throw";
              context.arg = record.arg;
            }
          }
        };
      }
      function maybeInvokeDelegate(delegate, context) {
        var methodName = context.method;
        var method = delegate.iterator[methodName];
        if (method === undefined$1) {
          context.delegate = null;
          if (methodName === "throw" && delegate.iterator["return"]) {
            context.method = "return";
            context.arg = undefined$1;
            maybeInvokeDelegate(delegate, context);
            if (context.method === "throw") {
              return ContinueSentinel;
            }
          }
          if (methodName !== "return") {
            context.method = "throw";
            context.arg = new TypeError(
              "The iterator does not provide a '" + methodName + "' method"
            );
          }
          return ContinueSentinel;
        }
        var record = tryCatch(method, delegate.iterator, context.arg);
        if (record.type === "throw") {
          context.method = "throw";
          context.arg = record.arg;
          context.delegate = null;
          return ContinueSentinel;
        }
        var info = record.arg;
        if (!info) {
          context.method = "throw";
          context.arg = new TypeError("iterator result is not an object");
          context.delegate = null;
          return ContinueSentinel;
        }
        if (info.done) {
          context[delegate.resultName] = info.value;
          context.next = delegate.nextLoc;
          if (context.method !== "return") {
            context.method = "next";
            context.arg = undefined$1;
          }
        } else {
          return info;
        }
        context.delegate = null;
        return ContinueSentinel;
      }
      defineIteratorMethods(Gp);
      define(Gp, toStringTagSymbol, "Generator");
      define(Gp, iteratorSymbol, function() {
        return this;
      });
      define(Gp, "toString", function() {
        return "[object Generator]";
      });
      function pushTryEntry(locs) {
        var entry = { tryLoc: locs[0] };
        if (1 in locs) {
          entry.catchLoc = locs[1];
        }
        if (2 in locs) {
          entry.finallyLoc = locs[2];
          entry.afterLoc = locs[3];
        }
        this.tryEntries.push(entry);
      }
      function resetTryEntry(entry) {
        var record = entry.completion || {};
        record.type = "normal";
        delete record.arg;
        entry.completion = record;
      }
      function Context(tryLocsList) {
        this.tryEntries = [{ tryLoc: "root" }];
        tryLocsList.forEach(pushTryEntry, this);
        this.reset(true);
      }
      exports.keys = function(val) {
        var object = Object(val);
        var keys = [];
        for (var key in object) {
          keys.push(key);
        }
        keys.reverse();
        return function next() {
          while (keys.length) {
            var key2 = keys.pop();
            if (key2 in object) {
              next.value = key2;
              next.done = false;
              return next;
            }
          }
          next.done = true;
          return next;
        };
      };
      function values(iterable) {
        if (iterable) {
          var iteratorMethod = iterable[iteratorSymbol];
          if (iteratorMethod) {
            return iteratorMethod.call(iterable);
          }
          if (typeof iterable.next === "function") {
            return iterable;
          }
          if (!isNaN(iterable.length)) {
            var i = -1, next = function next2() {
              while (++i < iterable.length) {
                if (hasOwn.call(iterable, i)) {
                  next2.value = iterable[i];
                  next2.done = false;
                  return next2;
                }
              }
              next2.value = undefined$1;
              next2.done = true;
              return next2;
            };
            return next.next = next;
          }
        }
        return { next: doneResult };
      }
      exports.values = values;
      function doneResult() {
        return { value: undefined$1, done: true };
      }
      Context.prototype = {
        constructor: Context,
        reset: function(skipTempReset) {
          this.prev = 0;
          this.next = 0;
          this.sent = this._sent = undefined$1;
          this.done = false;
          this.delegate = null;
          this.method = "next";
          this.arg = undefined$1;
          this.tryEntries.forEach(resetTryEntry);
          if (!skipTempReset) {
            for (var name2 in this) {
              if (name2.charAt(0) === "t" && hasOwn.call(this, name2) && !isNaN(+name2.slice(1))) {
                this[name2] = undefined$1;
              }
            }
          }
        },
        stop: function() {
          this.done = true;
          var rootEntry = this.tryEntries[0];
          var rootRecord = rootEntry.completion;
          if (rootRecord.type === "throw") {
            throw rootRecord.arg;
          }
          return this.rval;
        },
        dispatchException: function(exception) {
          if (this.done) {
            throw exception;
          }
          var context = this;
          function handle(loc, caught) {
            record.type = "throw";
            record.arg = exception;
            context.next = loc;
            if (caught) {
              context.method = "next";
              context.arg = undefined$1;
            }
            return !!caught;
          }
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            var record = entry.completion;
            if (entry.tryLoc === "root") {
              return handle("end");
            }
            if (entry.tryLoc <= this.prev) {
              var hasCatch = hasOwn.call(entry, "catchLoc");
              var hasFinally = hasOwn.call(entry, "finallyLoc");
              if (hasCatch && hasFinally) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                } else if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }
              } else if (hasCatch) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                }
              } else if (hasFinally) {
                if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }
              } else {
                throw new Error("try statement without catch or finally");
              }
            }
          }
        },
        abrupt: function(type2, arg) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
              var finallyEntry = entry;
              break;
            }
          }
          if (finallyEntry && (type2 === "break" || type2 === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
            finallyEntry = null;
          }
          var record = finallyEntry ? finallyEntry.completion : {};
          record.type = type2;
          record.arg = arg;
          if (finallyEntry) {
            this.method = "next";
            this.next = finallyEntry.finallyLoc;
            return ContinueSentinel;
          }
          return this.complete(record);
        },
        complete: function(record, afterLoc) {
          if (record.type === "throw") {
            throw record.arg;
          }
          if (record.type === "break" || record.type === "continue") {
            this.next = record.arg;
          } else if (record.type === "return") {
            this.rval = this.arg = record.arg;
            this.method = "return";
            this.next = "end";
          } else if (record.type === "normal" && afterLoc) {
            this.next = afterLoc;
          }
          return ContinueSentinel;
        },
        finish: function(finallyLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.finallyLoc === finallyLoc) {
              this.complete(entry.completion, entry.afterLoc);
              resetTryEntry(entry);
              return ContinueSentinel;
            }
          }
        },
        "catch": function(tryLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.tryLoc === tryLoc) {
              var record = entry.completion;
              if (record.type === "throw") {
                var thrown = record.arg;
                resetTryEntry(entry);
              }
              return thrown;
            }
          }
          throw new Error("illegal catch attempt");
        },
        delegateYield: function(iterable, resultName, nextLoc) {
          this.delegate = {
            iterator: values(iterable),
            resultName,
            nextLoc
          };
          if (this.method === "next") {
            this.arg = undefined$1;
          }
          return ContinueSentinel;
        }
      };
      return exports;
    }(
      // If this script is executing as a CommonJS module, use module.exports
      // as the regeneratorRuntime namespace. Otherwise create a new empty
      // object. Either way, the resulting object will be used to initialize
      // the regeneratorRuntime variable at the top of this file.
      module.exports
    );
    try {
      regeneratorRuntime = runtime2;
    } catch (accidentalStrictMode) {
      if (typeof globalThis === "object") {
        globalThis.regeneratorRuntime = runtime2;
      } else {
        Function("r", "regeneratorRuntime = r")(runtime2);
      }
    }
  })(runtime);
  var getId$3 = (prefix, cnt) => `${prefix}-${cnt}-${Math.random().toString(16).slice(3, 8)}`;
  const getId$2 = getId$3;
  let jobCounter = 0;
  var createJob$2 = ({
    id: _id,
    action,
    payload = {}
  }) => {
    let id = _id;
    if (typeof id === "undefined") {
      id = getId$2("Job", jobCounter);
      jobCounter += 1;
    }
    return {
      id,
      action,
      payload
    };
  };
  var log$2 = {};
  let logging = false;
  log$2.logging = logging;
  log$2.setLogging = (_logging) => {
    logging = _logging;
  };
  log$2.log = (...args) => logging ? console.log.apply(void 0, args) : null;
  const createJob$1 = createJob$2;
  const { log: log$1 } = log$2;
  const getId$1 = getId$3;
  let schedulerCounter = 0;
  var createScheduler$1 = () => {
    const id = getId$1("Scheduler", schedulerCounter);
    const workers = {};
    const runningWorkers = {};
    let jobQueue = [];
    schedulerCounter += 1;
    const getQueueLen = () => jobQueue.length;
    const getNumWorkers = () => Object.keys(workers).length;
    const dequeue = () => {
      if (jobQueue.length !== 0) {
        const wIds = Object.keys(workers);
        for (let i = 0; i < wIds.length; i += 1) {
          if (typeof runningWorkers[wIds[i]] === "undefined") {
            jobQueue[0](workers[wIds[i]]);
            break;
          }
        }
      }
    };
    const queue = (action, payload) => new Promise((resolve, reject) => {
      const job = createJob$1({ action, payload });
      jobQueue.push(async (w) => {
        jobQueue.shift();
        runningWorkers[w.id] = job;
        try {
          resolve(await w[action].apply(void 0, [...payload, job.id]));
        } catch (err) {
          reject(err);
        } finally {
          delete runningWorkers[w.id];
          dequeue();
        }
      });
      log$1(`[${id}]: Add ${job.id} to JobQueue`);
      log$1(`[${id}]: JobQueue length=${jobQueue.length}`);
      dequeue();
    });
    const addWorker = (w) => {
      workers[w.id] = w;
      log$1(`[${id}]: Add ${w.id}`);
      log$1(`[${id}]: Number of workers=${getNumWorkers()}`);
      dequeue();
      return w.id;
    };
    const addJob = async (action, ...payload) => {
      if (getNumWorkers() === 0) {
        throw Error(`[${id}]: You need to have at least one worker before adding jobs`);
      }
      return queue(action, payload);
    };
    const terminate = async () => {
      Object.keys(workers).forEach(async (wid) => {
        await workers[wid].terminate();
      });
      jobQueue = [];
    };
    return {
      addWorker,
      addJob,
      terminate,
      getQueueLen,
      getNumWorkers
    };
  };
  function commonjsRequire(path) {
    throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
  }
  var getEnvironment = (key) => {
    const env = {};
    if (typeof WorkerGlobalScope !== "undefined") {
      env.type = "webworker";
    } else if (typeof document === "object") {
      env.type = "browser";
    } else if (typeof process === "object" && typeof commonjsRequire === "function") {
      env.type = "node";
    }
    if (typeof key === "undefined") {
      return env;
    }
    return env[key];
  };
  const isBrowser = getEnvironment("type") === "browser";
  const resolveURL = isBrowser ? (s) => new URL(s, window.location.href).href : (s) => s;
  var resolvePaths$1 = (options) => {
    const opts = { ...options };
    ["corePath", "workerPath", "langPath"].forEach((key) => {
      if (options[key]) {
        opts[key] = resolveURL(opts[key]);
      }
    });
    return opts;
  };
  var OEM$2 = {
    TESSERACT_ONLY: 0,
    LSTM_ONLY: 1,
    TESSERACT_LSTM_COMBINED: 2,
    DEFAULT: 3
  };
  const name = "tesseract.js";
  const version$1 = "6.0.1";
  const description = "Pure Javascript Multilingual OCR";
  const main = "src/index.js";
  const type = "commonjs";
  const types = "src/index.d.ts";
  const unpkg = "dist/tesseract.min.js";
  const jsdelivr = "dist/tesseract.min.js";
  const scripts = {
    start: "node scripts/server.js",
    build: "rimraf dist && webpack --config scripts/webpack.config.prod.js && rollup -c scripts/rollup.esm.mjs",
    "profile:tesseract": "webpack-bundle-analyzer dist/tesseract-stats.json",
    "profile:worker": "webpack-bundle-analyzer dist/worker-stats.json",
    prepublishOnly: "npm run build",
    wait: "rimraf dist && wait-on http://localhost:3000/dist/tesseract.min.js",
    test: "npm-run-all -p -r start test:all",
    "test:all": "npm-run-all wait test:browser test:node:all",
    "test:browser": "karma start karma.conf.js",
    "test:node": "nyc mocha --exit --bail --require ./scripts/test-helper.mjs",
    "test:node:all": "npm run test:node -- ./tests/*.test.mjs",
    lint: "eslint src",
    "lint:fix": "eslint --fix src",
    postinstall: "opencollective-postinstall || true"
  };
  const browser$1 = {
    "./src/worker/node/index.js": "./src/worker/browser/index.js"
  };
  const author = "";
  const contributors = [
    "jeromewu"
  ];
  const license = "Apache-2.0";
  const devDependencies = {
    "@babel/core": "^7.21.4",
    "@babel/eslint-parser": "^7.21.3",
    "@babel/preset-env": "^7.21.4",
    "@rollup/plugin-commonjs": "^24.1.0",
    acorn: "^8.8.2",
    "babel-loader": "^9.1.2",
    buffer: "^6.0.3",
    cors: "^2.8.5",
    eslint: "^7.32.0",
    "eslint-config-airbnb-base": "^14.2.1",
    "eslint-plugin-import": "^2.27.5",
    "expect.js": "^0.3.1",
    express: "^4.18.2",
    mocha: "^10.2.0",
    "npm-run-all": "^4.1.5",
    karma: "^6.4.2",
    "karma-chrome-launcher": "^3.2.0",
    "karma-firefox-launcher": "^2.1.2",
    "karma-mocha": "^2.0.1",
    "karma-webpack": "^5.0.0",
    nyc: "^15.1.0",
    rimraf: "^5.0.0",
    rollup: "^3.20.7",
    "wait-on": "^7.0.1",
    webpack: "^5.79.0",
    "webpack-bundle-analyzer": "^4.8.0",
    "webpack-cli": "^5.0.1",
    "webpack-dev-middleware": "^6.0.2",
    "rollup-plugin-sourcemaps": "^0.6.3"
  };
  const dependencies = {
    "bmp-js": "^0.1.0",
    "idb-keyval": "^6.2.0",
    "is-url": "^1.2.4",
    "node-fetch": "^2.6.9",
    "opencollective-postinstall": "^2.0.3",
    "regenerator-runtime": "^0.13.3",
    "tesseract.js-core": "^6.0.0",
    "wasm-feature-detect": "^1.2.11",
    zlibjs: "^0.3.1"
  };
  const overrides = {
    "@rollup/pluginutils": "^5.0.2"
  };
  const repository = {
    type: "git",
    url: "https://github.com/naptha/tesseract.js.git"
  };
  const bugs = {
    url: "https://github.com/naptha/tesseract.js/issues"
  };
  const homepage = "https://github.com/naptha/tesseract.js";
  const collective = {
    type: "opencollective",
    url: "https://opencollective.com/tesseractjs"
  };
  const require$$0 = {
    name,
    version: version$1,
    description,
    main,
    type,
    types,
    unpkg,
    jsdelivr,
    scripts,
    browser: browser$1,
    author,
    contributors,
    license,
    devDependencies,
    dependencies,
    overrides,
    repository,
    bugs,
    homepage,
    collective
  };
  var defaultOptions$3 = {
    /*
     * Use BlobURL for worker script by default
     * TODO: remove this option
     *
     */
    workerBlobURL: true,
    logger: () => {
    }
  };
  const version = require$$0.version;
  const defaultOptions$2 = defaultOptions$3;
  var defaultOptions_1 = {
    ...defaultOptions$2,
    workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@v${version}/dist/worker.min.js`
  };
  var spawnWorker$2 = ({ workerPath, workerBlobURL }) => {
    let worker;
    if (Blob && URL && workerBlobURL) {
      const blob = new Blob([`importScripts("${workerPath}");`], {
        type: "application/javascript"
      });
      worker = new Worker(URL.createObjectURL(blob));
    } else {
      worker = new Worker(workerPath);
    }
    return worker;
  };
  var terminateWorker$2 = (worker) => {
    worker.terminate();
  };
  var onMessage$2 = (worker, handler) => {
    worker.onmessage = ({ data }) => {
      handler(data);
    };
  };
  var send$2 = async (worker, packet) => {
    worker.postMessage(packet);
  };
  const readFromBlobOrFile = (blob) => new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      resolve(fileReader.result);
    };
    fileReader.onerror = ({ target: { error: { code } } }) => {
      reject(Error(`File could not be read! Code=${code}`));
    };
    fileReader.readAsArrayBuffer(blob);
  });
  const loadImage$2 = async (image) => {
    let data = image;
    if (typeof image === "undefined") {
      return "undefined";
    }
    if (typeof image === "string") {
      if (/data:image\/([a-zA-Z]*);base64,([^"]*)/.test(image)) {
        data = atob(image.split(",")[1]).split("").map((c) => c.charCodeAt(0));
      } else {
        const resp = await fetch(image);
        data = await resp.arrayBuffer();
      }
    } else if (typeof HTMLElement !== "undefined" && image instanceof HTMLElement) {
      if (image.tagName === "IMG") {
        data = await loadImage$2(image.src);
      }
      if (image.tagName === "VIDEO") {
        data = await loadImage$2(image.poster);
      }
      if (image.tagName === "CANVAS") {
        await new Promise((resolve) => {
          image.toBlob(async (blob) => {
            data = await readFromBlobOrFile(blob);
            resolve();
          });
        });
      }
    } else if (typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas) {
      const blob = await image.convertToBlob();
      data = await readFromBlobOrFile(blob);
    } else if (image instanceof File || image instanceof Blob) {
      data = await readFromBlobOrFile(image);
    }
    return new Uint8Array(data);
  };
  var loadImage_1 = loadImage$2;
  const defaultOptions$1 = defaultOptions_1;
  const spawnWorker$1 = spawnWorker$2;
  const terminateWorker$1 = terminateWorker$2;
  const onMessage$1 = onMessage$2;
  const send$1 = send$2;
  const loadImage$1 = loadImage_1;
  var browser = {
    defaultOptions: defaultOptions$1,
    spawnWorker: spawnWorker$1,
    terminateWorker: terminateWorker$1,
    onMessage: onMessage$1,
    send: send$1,
    loadImage: loadImage$1
  };
  const resolvePaths = resolvePaths$1;
  const createJob = createJob$2;
  const { log } = log$2;
  const getId = getId$3;
  const OEM$1 = OEM$2;
  const {
    defaultOptions,
    spawnWorker,
    terminateWorker,
    onMessage,
    loadImage,
    send
  } = browser;
  let workerCounter = 0;
  var createWorker$2 = async (langs = "eng", oem = OEM$1.LSTM_ONLY, _options = {}, config = {}) => {
    const id = getId("Worker", workerCounter);
    const {
      logger,
      errorHandler,
      ...options
    } = resolvePaths({
      ...defaultOptions,
      ..._options
    });
    const promises = {};
    const currentLangs = typeof langs === "string" ? langs.split("+") : langs;
    let currentOem = oem;
    let currentConfig = config;
    const lstmOnlyCore = [OEM$1.DEFAULT, OEM$1.LSTM_ONLY].includes(oem) && !options.legacyCore;
    let workerResReject;
    let workerResResolve;
    const workerRes = new Promise((resolve, reject) => {
      workerResResolve = resolve;
      workerResReject = reject;
    });
    const workerError = (event) => {
      workerResReject(event.message);
    };
    let worker = spawnWorker(options);
    worker.onerror = workerError;
    workerCounter += 1;
    const startJob = ({ id: jobId, action, payload }) => new Promise((resolve, reject) => {
      log(`[${id}]: Start ${jobId}, action=${action}`);
      const promiseId = `${action}-${jobId}`;
      promises[promiseId] = { resolve, reject };
      send(worker, {
        workerId: id,
        jobId,
        action,
        payload
      });
    });
    const load = () => formatAppLog("warn", "at node_modules/tesseract.js/src/createWorker.js:67", "`load` is depreciated and should be removed from code (workers now come pre-loaded)");
    const loadInternal = (jobId) => startJob(createJob({
      id: jobId,
      action: "load",
      payload: { options: { lstmOnly: lstmOnlyCore, corePath: options.corePath, logging: options.logging } }
    }));
    const writeText = (path, text, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method: "writeFile", args: [path, text] }
    }));
    const readText = (path, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method: "readFile", args: [path, { encoding: "utf8" }] }
    }));
    const removeFile = (path, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method: "unlink", args: [path] }
    }));
    const FS = (method, args, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method, args }
    }));
    const loadLanguageInternal = (_langs, jobId) => startJob(createJob({
      id: jobId,
      action: "loadLanguage",
      payload: {
        langs: _langs,
        options: {
          langPath: options.langPath,
          dataPath: options.dataPath,
          cachePath: options.cachePath,
          cacheMethod: options.cacheMethod,
          gzip: options.gzip,
          lstmOnly: [OEM$1.DEFAULT, OEM$1.LSTM_ONLY].includes(currentOem) && !options.legacyLang
        }
      }
    }));
    const initializeInternal = (_langs, _oem, _config, jobId) => startJob(createJob({
      id: jobId,
      action: "initialize",
      payload: { langs: _langs, oem: _oem, config: _config }
    }));
    const reinitialize = (langs2 = "eng", oem2, config2, jobId) => {
      if (lstmOnlyCore && [OEM$1.TESSERACT_ONLY, OEM$1.TESSERACT_LSTM_COMBINED].includes(oem2))
        throw Error("Legacy model requested but code missing.");
      const _oem = oem2 || currentOem;
      currentOem = _oem;
      const _config = config2 || currentConfig;
      currentConfig = _config;
      const langsArr = typeof langs2 === "string" ? langs2.split("+") : langs2;
      const _langs = langsArr.filter((x) => !currentLangs.includes(x));
      currentLangs.push(..._langs);
      if (_langs.length > 0) {
        return loadLanguageInternal(_langs, jobId).then(() => initializeInternal(langs2, _oem, _config, jobId));
      }
      return initializeInternal(langs2, _oem, _config, jobId);
    };
    const setParameters = (params = {}, jobId) => startJob(createJob({
      id: jobId,
      action: "setParameters",
      payload: { params }
    }));
    const recognize2 = async (image, opts = {}, output = {
      text: true
    }, jobId) => startJob(createJob({
      id: jobId,
      action: "recognize",
      payload: { image: await loadImage(image), options: opts, output }
    }));
    const detect2 = async (image, jobId) => {
      if (lstmOnlyCore)
        throw Error("`worker.detect` requires Legacy model, which was not loaded.");
      return startJob(createJob({
        id: jobId,
        action: "detect",
        payload: { image: await loadImage(image) }
      }));
    };
    const terminate = async () => {
      if (worker !== null) {
        terminateWorker(worker);
        worker = null;
      }
      return Promise.resolve();
    };
    onMessage(worker, ({
      workerId,
      jobId,
      status,
      action,
      data
    }) => {
      const promiseId = `${action}-${jobId}`;
      if (status === "resolve") {
        log(`[${workerId}]: Complete ${jobId}`);
        promises[promiseId].resolve({ jobId, data });
        delete promises[promiseId];
      } else if (status === "reject") {
        promises[promiseId].reject(data);
        delete promises[promiseId];
        if (action === "load")
          workerResReject(data);
        if (errorHandler) {
          errorHandler(data);
        } else {
          throw Error(data);
        }
      } else if (status === "progress") {
        logger({ ...data, userJobId: jobId });
      }
    });
    const resolveObj = {
      id,
      worker,
      load,
      writeText,
      readText,
      removeFile,
      FS,
      reinitialize,
      setParameters,
      recognize: recognize2,
      detect: detect2,
      terminate
    };
    loadInternal().then(() => loadLanguageInternal(langs)).then(() => initializeInternal(langs, oem, config)).then(() => workerResResolve(resolveObj)).catch(() => {
    });
    return workerRes;
  };
  const createWorker$1 = createWorker$2;
  const recognize = async (image, langs, options) => {
    const worker = await createWorker$1(langs, 1, options);
    return worker.recognize(image).finally(async () => {
      await worker.terminate();
    });
  };
  const detect = async (image, options) => {
    const worker = await createWorker$1("osd", 0, options);
    return worker.detect(image).finally(async () => {
      await worker.terminate();
    });
  };
  var Tesseract$1 = {
    recognize,
    detect
  };
  var languages$1 = {
    AFR: "afr",
    AMH: "amh",
    ARA: "ara",
    ASM: "asm",
    AZE: "aze",
    AZE_CYRL: "aze_cyrl",
    BEL: "bel",
    BEN: "ben",
    BOD: "bod",
    BOS: "bos",
    BUL: "bul",
    CAT: "cat",
    CEB: "ceb",
    CES: "ces",
    CHI_SIM: "chi_sim",
    CHI_TRA: "chi_tra",
    CHR: "chr",
    CYM: "cym",
    DAN: "dan",
    DEU: "deu",
    DZO: "dzo",
    ELL: "ell",
    ENG: "eng",
    ENM: "enm",
    EPO: "epo",
    EST: "est",
    EUS: "eus",
    FAS: "fas",
    FIN: "fin",
    FRA: "fra",
    FRK: "frk",
    FRM: "frm",
    GLE: "gle",
    GLG: "glg",
    GRC: "grc",
    GUJ: "guj",
    HAT: "hat",
    HEB: "heb",
    HIN: "hin",
    HRV: "hrv",
    HUN: "hun",
    IKU: "iku",
    IND: "ind",
    ISL: "isl",
    ITA: "ita",
    ITA_OLD: "ita_old",
    JAV: "jav",
    JPN: "jpn",
    KAN: "kan",
    KAT: "kat",
    KAT_OLD: "kat_old",
    KAZ: "kaz",
    KHM: "khm",
    KIR: "kir",
    KOR: "kor",
    KUR: "kur",
    LAO: "lao",
    LAT: "lat",
    LAV: "lav",
    LIT: "lit",
    MAL: "mal",
    MAR: "mar",
    MKD: "mkd",
    MLT: "mlt",
    MSA: "msa",
    MYA: "mya",
    NEP: "nep",
    NLD: "nld",
    NOR: "nor",
    ORI: "ori",
    PAN: "pan",
    POL: "pol",
    POR: "por",
    PUS: "pus",
    RON: "ron",
    RUS: "rus",
    SAN: "san",
    SIN: "sin",
    SLK: "slk",
    SLV: "slv",
    SPA: "spa",
    SPA_OLD: "spa_old",
    SQI: "sqi",
    SRP: "srp",
    SRP_LATN: "srp_latn",
    SWA: "swa",
    SWE: "swe",
    SYR: "syr",
    TAM: "tam",
    TEL: "tel",
    TGK: "tgk",
    TGL: "tgl",
    THA: "tha",
    TIR: "tir",
    TUR: "tur",
    UIG: "uig",
    UKR: "ukr",
    URD: "urd",
    UZB: "uzb",
    UZB_CYRL: "uzb_cyrl",
    VIE: "vie",
    YID: "yid"
  };
  var PSM$1 = {
    OSD_ONLY: "0",
    AUTO_OSD: "1",
    AUTO_ONLY: "2",
    AUTO: "3",
    SINGLE_COLUMN: "4",
    SINGLE_BLOCK_VERT_TEXT: "5",
    SINGLE_BLOCK: "6",
    SINGLE_LINE: "7",
    SINGLE_WORD: "8",
    CIRCLE_WORD: "9",
    SINGLE_CHAR: "10",
    SPARSE_TEXT: "11",
    SPARSE_TEXT_OSD: "12",
    RAW_LINE: "13"
  };
  const createScheduler = createScheduler$1;
  const createWorker = createWorker$2;
  const Tesseract = Tesseract$1;
  const languages = languages$1;
  const OEM = OEM$2;
  const PSM = PSM$1;
  const { setLogging } = log$2;
  var src = {
    languages,
    OEM,
    PSM,
    createScheduler,
    createWorker,
    setLogging,
    ...Tesseract
  };
  const _sfc_main$7 = {
    data() {
      return {
        deviceId: "",
        roomName: "",
        imageUrl: "",
        apiUrl: API_BASE_URL,
        isSubmitting: false,
        isRecognizing: false,
        previewAnimationData: {}
      };
    },
    computed: {
      canSubmit() {
        return this.deviceId.trim() !== "" && this.roomName.trim() !== "";
      }
    },
    onReady() {
      this.initAnimation();
    },
    methods: {
      // 为可能卡住的异步步骤提供超时保护，避免界面长期停留在“识别中”
      withTimeout(promise, ms, message) {
        return Promise.race([
          promise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message || "操作超时")), ms);
          })
        ]);
      },
      // 获取 Tesseract 资源路径（App和H5都用同样的相对路径）
      getTesseractBasePaths() {
        return ["/static/tesseract", "static/tesseract", "./static/tesseract"];
      },
      // 从识别文本提取最可能的房间号数字段，避免把整段文本数字全拼接
      extractRoomNumber(text) {
        const raw = String(text || "");
        const fullWidthToHalf = raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248));
        const upper = fullWidthToHalf.toUpperCase();
        const tokens = upper.split(/[^A-Z0-9\|!]+/).filter(Boolean);
        const candidates = [];
        for (const token of tokens) {
          if (!/[0-9OQDILSZBG\|!]/.test(token))
            continue;
          const fixed = token.replace(/[OQD]/g, "0").replace(/[IL\|!]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/G/g, "6");
          const groups = fixed.match(/[0-9]{1,6}/g) || [];
          for (const g of groups) {
            if (g.length >= 1 && g.length <= 6)
              candidates.push(g);
          }
        }
        if (candidates.length > 0) {
          const score = (v) => {
            if (v.length <= 4)
              return 100 - v.length;
            return 50 - (v.length - 4) * 15;
          };
          candidates.sort((a, b) => score(b) - score(a) || a.length - b.length);
          return candidates[0];
        }
        const fallback = upper.replace(/[OQD]/g, "0").replace(/[IL\|!]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/G/g, "6").replace(/[^0-9]/g, "");
        return fallback.length > 4 ? fallback.slice(0, 4) : fallback;
      },
      initAnimation() {
        const animation = uni.createAnimation({ duration: 300, timingFunction: "ease" });
        this.previewAnimationData = animation.opacity(1).translateY(0).step().export();
      },
      scanCode() {
        uni.scanCode({
          success: (res) => {
            this.deviceId = res.result;
            uni.showToast({ title: "扫码成功", icon: "success", duration: 1e3 });
          },
          fail: () => {
            uni.showToast({ title: "扫描失败，请重试", icon: "none" });
          }
        });
      },
      takePhoto() {
        uni.chooseImage({
          count: 1,
          sourceType: ["camera"],
          success: (res) => {
            this.imageUrl = res.tempFilePaths[0];
            this.initAnimation();
            this.recognizeRoomName(this.imageUrl);
          },
          fail: () => {
            uni.showToast({ title: "拍摄失败，请重试", icon: "none" });
          }
        });
      },
      // 将文件转为 base64 data URL
      async convertToBase64(filePath) {
        return new Promise((resolve, reject) => {
          let settled = false;
          const safeResolve = (value) => {
            if (settled)
              return;
            settled = true;
            resolve(value);
          };
          const safeReject = (err) => {
            if (settled)
              return;
            settled = true;
            reject(err);
          };
          if (typeof plus !== "undefined" && plus.io) {
            formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:177", "使用 plus.io 读取文件:", filePath);
            plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
              entry.file((file) => {
                const reader = new plus.io.FileReader();
                reader.onloadend = () => {
                  try {
                    const result = reader.result || "";
                    if (typeof result === "string" && result.indexOf("data:image") === 0) {
                      safeResolve(result);
                      return;
                    }
                    if (typeof result === "string" && result.length > 0) {
                      safeResolve("data:image/jpeg;base64," + result);
                      return;
                    }
                    safeReject(new Error("读取结果为空"));
                  } catch (err) {
                    formatAppLog("error", "at pages/deviceDeployment/deviceDeployment.vue:197", "base64编码失败:", err);
                    safeReject(err);
                  }
                };
                reader.onerror = (err) => {
                  formatAppLog("error", "at pages/deviceDeployment/deviceDeployment.vue:202", "文件读取失败:", err);
                  safeReject(err);
                };
                try {
                  reader.readAsDataURL(file);
                } catch (e) {
                  try {
                    reader.readAsText(file);
                  } catch (e2) {
                    safeReject(e2);
                  }
                }
              }, (err) => {
                formatAppLog("error", "at pages/deviceDeployment/deviceDeployment.vue:218", "获取文件对象失败:", err);
                safeReject(err);
              });
            }, (err) => {
              formatAppLog("error", "at pages/deviceDeployment/deviceDeployment.vue:222", "解析文件路径失败:", err);
              safeReject(err);
            });
          } else {
            formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:227", "使用 uni.getFileSystemManager 读取文件:", filePath);
            const fs = uni.getFileSystemManager();
            fs.readFile({
              filePath,
              encoding: "base64",
              success: (res) => {
                const base64Data = res.data;
                const dataUrl = "data:image/jpeg;base64," + base64Data;
                safeResolve(dataUrl);
              },
              fail: (err) => {
                formatAppLog("error", "at pages/deviceDeployment/deviceDeployment.vue:238", "转换失败:", err);
                safeReject(err);
              }
            });
          }
        });
      },
      // App 端走服务端 OCR，规避 tesseract.js 在基座里的 Blob 兼容问题
      async recognizeRoomNameByServer(imagePath) {
        return new Promise((resolve, reject) => {
          uni.uploadFile({
            url: `${this.apiUrl}/recognize_room.php`,
            filePath: imagePath,
            name: "room_image",
            success: (res) => {
              let normalized = "";
              try {
                const statusCode = Number(res.statusCode || 0);
                const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data || {});
                normalized = String(raw || "").replace(/^\uFEFF/, "").trim();
                formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:258", "OCR上传返回状态:", statusCode);
                formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:259", "OCR上传返回内容(前120):", normalized.substring(0, 120));
                if (statusCode !== 200) {
                  reject(new Error(`服务异常(${statusCode})`));
                  return;
                }
                if (!normalized) {
                  reject(new Error("服务端返回空响应，请检查 PHP 配置（exec 是否禁用、Tesseract 是否安装）"));
                  return;
                }
                const payload = JSON.parse(normalized);
                if (payload && payload.success) {
                  resolve(String(payload.roomName || ""));
                  return;
                }
                const msg = payload && payload.message ? payload.message : "服务端识别失败";
                const code = payload && payload.code ? payload.code : "";
                const detail = payload && payload.detail ? String(payload.detail) : "";
                const detailShort = detail ? ` ${detail.substring(0, 60)}` : "";
                reject(new Error(`${code ? code + ": " : ""}${msg}${detailShort}`));
              } catch (e) {
                const rawHint = normalized ? ` (响应前60字: ${normalized.substring(0, 60)})` : " (空响应)";
                reject(new Error(`识别结果解析失败${rawHint}`));
              }
            },
            fail: (err) => {
              const errMsg = err && err.errMsg ? err.errMsg : "图片上传失败";
              formatAppLog("error", "at pages/deviceDeployment/deviceDeployment.vue:291", "OCR上传失败详情:", err);
              reject(new Error(`上传失败: ${errMsg}`));
            }
          });
        });
      },
      // 本地 tesseract.js 识别
      async recognizeRoomName(imagePath) {
        if (this.isRecognizing)
          return;
        this.isRecognizing = true;
        uni.showLoading({ title: "识别中..." });
        let worker = null;
        try {
          if (typeof plus !== "undefined") {
            const serverText = await this.withTimeout(
              this.recognizeRoomNameByServer(imagePath),
              15e3,
              "服务端识别超时"
            );
            const appRoomNumber = String(serverText || "").replace(/[^0-9]/g, "").slice(0, 6);
            if (appRoomNumber) {
              this.roomName = appRoomNumber;
              uni.showToast({
                title: `识别成功：${appRoomNumber}`,
                icon: "success",
                duration: 2e3
              });
            } else {
              uni.showToast({
                title: "未识别到有效数字，请重拍",
                icon: "none",
                duration: 2e3
              });
            }
            return;
          }
          let recognizeInput = imagePath;
          const basePaths = this.getTesseractBasePaths();
          let result = null;
          let lastError = "";
          for (const basePath of basePaths) {
            try {
              formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:341", `尝试加载 Tesseract: ${basePath}`);
              worker = await this.withTimeout(
                src.createWorker("eng", 1, {
                  workerPath: `${basePath}/worker.min.js`,
                  corePath: `${basePath}/tesseract-core.wasm.js`,
                  langPath: basePath,
                  gzip: false,
                  workerBlobURL: false
                }),
                1e4,
                "OCR 引擎初始化超时"
              );
              formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:354", "开始识别图片");
              result = await this.withTimeout(
                worker.recognize(recognizeInput),
                15e3,
                "图片识别超时"
              );
              formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:360", "识别成功，结果:", result.data.text);
              break;
            } catch (pathErr) {
              lastError = pathErr && pathErr.message ? pathErr.message : String(pathErr || "unknown");
              formatAppLog("warn", "at pages/deviceDeployment/deviceDeployment.vue:364", `路径 ${basePath} 加载失败:`, lastError);
            } finally {
              if (worker) {
                try {
                  await worker.terminate();
                } catch (terminateErr) {
                }
                worker = null;
              }
            }
          }
          if (!result) {
            throw new Error(lastError || "资源加载失败，请检查 tesseract 文件是否存在");
          }
          const text = result && result.data && result.data.text ? result.data.text : "";
          const roomNumber = this.extractRoomNumber(text);
          if (roomNumber) {
            this.roomName = roomNumber;
            uni.showToast({
              title: `识别成功：${roomNumber}`,
              icon: "success",
              duration: 2e3
            });
            formatAppLog("log", "at pages/deviceDeployment/deviceDeployment.vue:389", "提取的房间号:", roomNumber);
          } else {
            uni.showToast({
              title: `未识别到有效数字（原文本：${text.substring(0, 20)}...）`,
              icon: "none",
              duration: 2e3
            });
            formatAppLog("warn", "at pages/deviceDeployment/deviceDeployment.vue:396", "未识别到数字，原文本:", text);
          }
        } catch (err) {
          const msg = err && err.message ? err.message : "本地识别失败";
          uni.showToast({
            title: `识别失败：${msg}`,
            icon: "none",
            duration: 2e3
          });
          formatAppLog("error", "at pages/deviceDeployment/deviceDeployment.vue:405", "识别异常:", err);
        } finally {
          if (worker) {
            try {
              await worker.terminate();
            } catch (terminateErr) {
            }
          }
          uni.hideLoading();
          this.isRecognizing = false;
        }
      },
      clearPreview() {
        this.imageUrl = "";
        const animation = uni.createAnimation({ duration: 300, timingFunction: "ease" });
        this.previewAnimationData = animation.opacity(0).translateY(50).step().export();
        setTimeout(() => {
          this.imageUrl = "";
        }, 300);
      },
      filterRoomName(e) {
        this.roomName = e.detail.value.replace(/[^0-9]/g, "");
      },
      submitData() {
        if (!this.canSubmit)
          return;
        this.isSubmitting = true;
        uni.request({
          url: `${this.apiUrl}/save.php`,
          method: "POST",
          data: { device_id: this.deviceId, room_name: this.roomName },
          header: { "Content-Type": "application/x-www-form-urlencoded" },
          success: (res) => {
            var _a, _b;
            this.isSubmitting = false;
            if ((_a = res.data) == null ? void 0 : _a.success) {
              uni.showToast({ title: "数据提交成功", icon: "success" });
              setTimeout(() => {
                this.deviceId = "";
                this.roomName = "";
                this.imageUrl = "";
              }, 2e3);
            } else {
              uni.showToast({ title: `提交失败：${((_b = res.data) == null ? void 0 : _b.message) || "未知错误"}`, icon: "none" });
            }
          },
          fail: () => {
            this.isSubmitting = false;
            uni.showToast({ title: "网络连接失败", icon: "none" });
          }
        });
      }
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "device-deploy" }, [
      vue.createElementVNode("view", { class: "form-module" }, [
        vue.createElementVNode("view", { class: "module-title" }, "设备编号"),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "手动输入"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              type: "text",
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.deviceId = $event),
              placeholder: "请输入设备编号",
              class: "input-control"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.deviceId]
          ])
        ]),
        vue.createElementVNode("view", { class: "scan-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "扫码识别"),
          vue.createElementVNode("button", {
            onClick: _cache[1] || (_cache[1] = (...args) => $options.scanCode && $options.scanCode(...args)),
            class: "scan-btn"
          }, [
            vue.createElementVNode("text", { class: "icon" }),
            vue.createTextVNode(" 扫描设备二维码 ")
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "form-module" }, [
        vue.createElementVNode("view", { class: "module-title" }, "舱室编号"),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "手动输入"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              type: "text",
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.roomName = $event),
              placeholder: "请输入舱室编号（仅数字）",
              class: "input-control",
              onInput: _cache[3] || (_cache[3] = (...args) => $options.filterRoomName && $options.filterRoomName(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.roomName]
          ])
        ]),
        vue.createElementVNode("view", { class: "scan-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "拍照识别"),
          vue.createElementVNode("button", {
            onClick: _cache[4] || (_cache[4] = (...args) => $options.takePhoto && $options.takePhoto(...args)),
            class: "scan-btn",
            disabled: $data.isRecognizing
          }, [
            vue.createElementVNode("text", { class: "icon" }),
            vue.createTextVNode(
              " " + vue.toDisplayString($data.isRecognizing ? "识别中..." : "拍摄房间标识"),
              1
              /* TEXT */
            )
          ], 8, ["disabled"])
        ])
      ]),
      $data.imageUrl ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "photo-preview",
        animation: "{{previewAnimationData}}"
      }, [
        vue.createElementVNode("image", {
          src: $data.imageUrl,
          mode: "widthFix",
          class: "preview-img"
        }, null, 8, ["src"]),
        vue.createElementVNode("view", { class: "mask" }),
        vue.createElementVNode("text", {
          class: "preview-tip",
          onClick: _cache[5] || (_cache[5] = (...args) => $options.clearPreview && $options.clearPreview(...args))
        }, "点击清除预览")
      ])) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("button", {
        onClick: _cache[6] || (_cache[6] = (...args) => $options.submitData && $options.submitData(...args)),
        class: "submit-btn",
        disabled: !$options.canSubmit || $data.isSubmitting
      }, [
        $data.isSubmitting ? (vue.openBlock(), vue.createElementBlock("text", {
          key: 0,
          class: "loading-icon"
        })) : (vue.openBlock(), vue.createElementBlock("text", { key: 1 }, "提交部署信息"))
      ], 8, ["disabled"])
    ]);
  }
  const PagesDeviceDeploymentDeviceDeployment = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__scopeId", "data-v-da6bd99d"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/deviceDeployment/deviceDeployment.vue"]]);
  const _sfc_main$6 = {
    data() {
      return {
        devices: [],
        // 所有需要更换电池的设备
        lowPowerCount: 0,
        // 低电量设备数量
        roomList: [],
        // 房间列表
        selectedRoomIndex: 0,
        // 选中的房间索引
        selectedRoom: "",
        // 选中的房间名称
        deviceCount: 0,
        // 设备总数
        isLoading: true,
        // 加载状态
        isRefreshing: false
        // 刷新状态
      };
    },
    onLoad() {
      this.getData();
    },
    computed: {
      // 筛选后的设备列表
      filteredDevices() {
        if (!this.selectedRoom || this.selectedRoom === "全部房间") {
          return this.devices;
        }
        return this.devices.filter((device) => device.room_code === this.selectedRoom);
      }
    },
    methods: {
      // 获取数据
      getData() {
        this.isLoading = true;
        uni.request({
          url: API_URLS.TEST1,
          method: "GET",
          success: (res) => {
            const source = getLatestByRadarId(normalizeTest1Rows(res.data));
            this.devices = source.map((item) => ({
              device_id: item.device_code || "",
              room_code: item.room_name || item.room_code || "",
              electricity: Number(item.dl || 0),
              alarm_status: Number(item.Alarm) === 0,
              radar_id: item.radar_id || ""
            }));
            this.deviceCount = this.devices.length;
            this.lowPowerCount = this.devices.filter((device) => Number(device.electricity) < 20).length;
            this.extractRoomList();
          },
          fail: (err) => {
            formatAppLog("error", "at pages/batteryMonitor/batteryMonitor.vue:139", "获取数据失败：", err);
            this.loadFromGetdata();
          },
          complete: () => {
            this.isLoading = false;
            this.isRefreshing = false;
          }
        });
      },
      loadFromGetdata() {
        uni.request({
          url: API_URLS.TEST1,
          method: "GET",
          timeout: 8e3,
          success: (res) => {
            if (res.statusCode !== 200 || !res.data) {
              uni.showToast({ title: "接口不可达，请检查服务", icon: "none", duration: 2e3 });
              return;
            }
            const source = getLatestByRadarId(normalizeTest1Rows(res.data));
            this.devices = source.map((item) => ({
              device_id: item.device_code || "",
              room_code: item.room_name || item.room_code || "",
              electricity: Number(item.dl || 0),
              alarm_status: Number(item.Alarm) === 0,
              radar_id: item.radar_id || ""
            }));
            this.deviceCount = this.devices.length;
            this.lowPowerCount = this.devices.filter((device) => Number(device.electricity) < 20).length;
            this.extractRoomList();
            uni.showToast({ title: "成功加载", icon: "none", duration: 2e3 });
          },
          fail: (err) => {
            const msg = err && err.errMsg ? err.errMsg : "网络异常";
            uni.showToast({ title: `网络错误：${msg}`, icon: "none", duration: 2500 });
          }
        });
      },
      // 刷新数据
      refreshData() {
        this.isRefreshing = true;
        this.getData();
      },
      // 提取房间列表
      extractRoomList() {
        const rooms = /* @__PURE__ */ new Set();
        this.devices.forEach((device) => {
          rooms.add(device.room_code);
        });
        this.roomList = [{ room_name: "全部房间" }, ...Array.from(rooms).map((room) => ({ room_name: room }))];
        this.selectedRoomIndex = 0;
        this.selectedRoom = "全部房间";
      },
      // 房间选择变化
      onRoomChange(e) {
        this.selectedRoomIndex = e.detail.value;
        this.selectedRoom = this.roomList[this.selectedRoomIndex].room_name;
      },
      // 显示设备详情
      showDeviceDetail(device) {
        uni.showModal({
          title: "设备详情",
          content: `设备编号：${device.device_id}
房间名称：${device.room_code}
电量：${device.electricity}%
报警状态：${device.alarm_status ? "正常" : "已报警"}`,
          showCancel: false
        });
      },
      // 根据电量获取电池指示器颜色
      getBatteryColor(level) {
        if (level <= 10)
          return "#e74c3c";
        if (level <= 20)
          return "#f39c12";
        return "#2ecc71";
      }
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode(
        "view",
        {
          class: vue.normalizeClass(["stats-card", { "pulse-animation": $data.isRefreshing }])
        },
        [
          vue.createElementVNode("view", { class: "stats-label" }, "设备总数"),
          vue.createElementVNode(
            "view",
            { class: "stats-value" },
            vue.toDisplayString($data.deviceCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "view",
            { class: "stats-desc" },
            "低电量设备 " + vue.toDisplayString($data.lowPowerCount) + " 台",
            1
            /* TEXT */
          )
        ],
        2
        /* CLASS */
      ),
      vue.createElementVNode("view", { class: "filter-section" }, [
        vue.createElementVNode("text", { class: "filter-label" }, "按房间筛选："),
        vue.createElementVNode("picker", {
          onChange: _cache[0] || (_cache[0] = (...args) => $options.onRoomChange && $options.onRoomChange(...args)),
          value: $data.selectedRoomIndex,
          range: $data.roomList,
          "range-key": "room_name"
        }, [
          vue.createElementVNode("view", { class: "picker-view" }, [
            vue.createTextVNode(
              vue.toDisplayString($data.selectedRoom || "全部房间") + " ",
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "picker-arrow" }, "▾")
          ])
        ], 40, ["value", "range"])
      ]),
      vue.createElementVNode("view", { class: "device-modules" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.filteredDevices, (device, index) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              class: "device-module",
              key: device.id,
              onClick: ($event) => $options.showDeviceDetail(device)
            }, [
              vue.createElementVNode("view", { class: "module-header" }, [
                vue.createElementVNode("text", { class: "module-title" }, "设备信息"),
                vue.createElementVNode("text", { class: "module-arrow" }, "›")
              ]),
              vue.createElementVNode("view", { class: "module-content" }, [
                vue.createElementVNode("view", { class: "info-item" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "设备编号："),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value" },
                    vue.toDisplayString(device.device_id),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-item" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "舱室编号："),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value" },
                    vue.toDisplayString(device.room_code),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-item" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "电量状态："),
                  vue.createElementVNode("view", { class: "battery-container" }, [
                    vue.createElementVNode(
                      "view",
                      {
                        class: "battery-indicator",
                        style: vue.normalizeStyle({
                          width: device.electricity + "%",
                          backgroundColor: $options.getBatteryColor(device.electricity)
                        })
                      },
                      null,
                      4
                      /* STYLE */
                    ),
                    vue.createElementVNode(
                      "text",
                      {
                        class: "battery-text",
                        style: vue.normalizeStyle({ color: $options.getBatteryColor(device.electricity) })
                      },
                      vue.toDisplayString(device.electricity) + "% ",
                      5
                      /* TEXT, STYLE */
                    )
                  ])
                ])
              ])
            ], 8, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        $options.filteredDevices.length === 0 && !$data.isLoading ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty-state"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "□"),
          vue.createElementVNode("text", { class: "empty-text" }, "当前没有需要更换电池的设备")
        ])) : vue.createCommentVNode("v-if", true),
        $data.isLoading ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "loading-state"
        }, [
          vue.createElementVNode("view", { class: "loading-spinner" }),
          vue.createElementVNode("text", { class: "loading-text" }, "加载中...")
        ])) : vue.createCommentVNode("v-if", true)
      ])
    ]);
  }
  const PagesBatteryMonitorBatteryMonitor = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__scopeId", "data-v-93d46dcf"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/batteryMonitor/batteryMonitor.vue"]]);
  const _sfc_main$5 = {
    data() {
      return {
        alarmList: [],
        // 报警列表数据
        statusCount: {
          // 状态统计
          normal: 0,
          alarm: 0
        },
        refreshTimer: null,
        // 定时刷新计时器
        loading: true,
        // 加载状态
        lastRefreshTime: "",
        // 最后刷新时间
        refreshSuccess: true
        // 刷新状态
      };
    },
    computed: {
      // 按涉及人员数量排序报警列表（人数多的在前）
      sortedAlarmList() {
        return [...this.alarmList].sort((a, b) => {
          const peopleA = parseInt(a.people_number) || 0;
          const peopleB = parseInt(b.people_number) || 0;
          if (peopleB !== peopleA) {
            return peopleB - peopleA;
          }
          return new Date(b.created_at) - new Date(a.created_at);
        });
      }
    },
    onLoad() {
      this.fetchData();
      this.refreshTimer = setInterval(() => {
        this.fetchData();
      }, 5e3);
    },
    onHide() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    },
    onUnload() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    },
    methods: {
      // 获取报警数据
      async fetchData() {
        this.loading = true;
        try {
          const res = await uni.request({
            url: API_URLS.FIRE_MONITOR,
            method: "GET"
          });
          if (res.statusCode === 200) {
            const source = getLatestByRadarId(normalizeTest1Rows(res.data));
            this.alarmList = source.map((item) => ({
              id: item.id,
              room_code: item.room_name || item.room_code || "",
              device_code: item.device_code || "",
              people_number: item.people_number || 0,
              created_at: item.time || item.created_at || "",
              alarm: Number(item.Alarm) === 0,
              is_processed: Number(item.is_processed) === 1
            }));
            this.statusCount = {
              normal: source.filter((item) => Number(item.Alarm) !== 0).length,
              alarm: source.filter((item) => Number(item.Alarm) === 0).length
            };
            this.refreshSuccess = true;
            this.lastRefreshTime = this.formatTime(/* @__PURE__ */ new Date());
          } else {
            this.refreshSuccess = false;
            uni.showToast({ title: res.data.msg || "获取数据失败", icon: "none" });
          }
        } catch (error) {
          this.refreshSuccess = false;
          uni.showToast({ title: "网络请求错误", icon: "none" });
        } finally {
          this.loading = false;
        }
      },
      // 格式化时间
      formatTime(date) {
        const year = date.getFullYear();
        const month = this.padZero(date.getMonth() + 1);
        const day = this.padZero(date.getDate());
        const hours = this.padZero(date.getHours());
        const minutes = this.padZero(date.getMinutes());
        const seconds = this.padZero(date.getSeconds());
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      },
      // 补零函数
      padZero(n) {
        return n < 10 ? "0" + n : n;
      }
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "status-header" }, [
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["status-item normal", { pulse: $data.statusCount.normal > 0 }])
          },
          [
            vue.createElementVNode("view", { class: "status-icon" }, [
              vue.createElementVNode("i", { class: "iconfont icon-check-circle" })
            ]),
            vue.createElementVNode("text", { class: "status-label" }, "正常设备"),
            vue.createElementVNode(
              "text",
              { class: "status-value" },
              vue.toDisplayString($data.statusCount.normal),
              1
              /* TEXT */
            )
          ],
          2
          /* CLASS */
        ),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["status-item alarm", { pulse: $data.statusCount.alarm > 0 }])
          },
          [
            vue.createElementVNode("view", { class: "status-icon" }, [
              vue.createElementVNode("i", { class: "iconfont icon-exclamation-circle" })
            ]),
            vue.createElementVNode("text", { class: "status-label" }, "报警设备"),
            vue.createElementVNode(
              "text",
              { class: "status-value" },
              vue.toDisplayString($data.statusCount.alarm),
              1
              /* TEXT */
            )
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createElementVNode("view", { class: "refresh-info" }, [
        vue.createElementVNode(
          "text",
          null,
          "最后刷新：" + vue.toDisplayString($data.lastRefreshTime || "加载中..."),
          1
          /* TEXT */
        ),
        vue.createElementVNode(
          "text",
          {
            class: vue.normalizeClass(["refresh-status", { success: $data.refreshSuccess, error: !$data.refreshSuccess }])
          },
          vue.toDisplayString($data.refreshSuccess ? "同步正常" : "同步异常"),
          3
          /* TEXT, CLASS */
        )
      ]),
      vue.createElementVNode("view", { class: "section-title" }, "报警信息列表"),
      !$data.loading ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "room-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.sortedAlarmList, (item, index) => {
            return vue.openBlock(), vue.createElementBlock(
              "view",
              {
                class: vue.normalizeClass(["room-item", { "emergency-item": index === 0 }]),
                key: item.id || index
              },
              [
                vue.createElementVNode("view", { class: "room-row" }, [
                  vue.createElementVNode("text", { class: "row-label" }, "舱室编号："),
                  vue.createElementVNode(
                    "text",
                    { class: "row-value" },
                    vue.toDisplayString(item.room_code),
                    1
                    /* TEXT */
                  ),
                  index === 0 ? (vue.openBlock(), vue.createElementBlock("text", {
                    key: 0,
                    class: "priority-badge"
                  }, " 紧急 ")) : vue.createCommentVNode("v-if", true)
                ]),
                vue.createElementVNode("view", { class: "room-row" }, [
                  vue.createElementVNode("text", { class: "row-label" }, "设备编号："),
                  vue.createElementVNode(
                    "text",
                    { class: "row-value" },
                    vue.toDisplayString(item.device_code),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "room-row" }, [
                  vue.createElementVNode("text", { class: "row-label" }, "报警时间："),
                  vue.createElementVNode(
                    "text",
                    { class: "row-value" },
                    vue.toDisplayString(item.created_at),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "room-row" }, [
                  vue.createElementVNode("text", { class: "row-label" }, "涉及人数："),
                  vue.createElementVNode(
                    "text",
                    { class: "row-value" },
                    vue.toDisplayString(item.people_number),
                    1
                    /* TEXT */
                  )
                ])
              ],
              2
              /* CLASS */
            );
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        $data.alarmList.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty-state"
        }, [
          vue.createElementVNode("i", { class: "iconfont icon-info-circle" }),
          vue.createElementVNode("text", null, "当前没有报警信息")
        ])) : vue.createCommentVNode("v-if", true)
      ])) : vue.createCommentVNode("v-if", true),
      $data.loading ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "loading-state"
      }, [
        vue.createElementVNode("view", { class: "spinner" }),
        vue.createElementVNode("text", null, "加载中...")
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesFireMonitorFireMonitor = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__scopeId", "data-v-cc46ccde"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/fireMonitor/fireMonitor.vue"]]);
  const FLOOR_OPTIONS = [1, 2, 3];
  const AUTO_REFRESH_MS = 6e4;
  const ROOM_COLORS = ["#3498db", "#3ea2e5", "#4aa9ea", "#58b2ee", "#2d86c7", "#4396d6"];
  const CORRIDOR_COLOR = "#7f97b4";
  const ALARM_COLOR = "#ff4d4f";
  const _sfc_main$4 = {
    data() {
      return {
        selectedFloor: 1,
        floorIndex: 0,
        floorLabels: FLOOR_OPTIONS.map((item) => `${item} 层`),
        rooms: [],
        corridorMarkers: [],
        statusText: "正在加载地图数据...",
        isStatusError: false,
        lastUpdateText: "未更新",
        boundsText: "坐标范围：未计算",
        canvasWidth: 340,
        canvasHeight: 250,
        roomCanvasWidth: 300,
        roomCanvasHeight: 190,
        autoRefreshTimer: null,
        roomMapApi: API_URLS.GET_ROOM_MAP,
        viewMode: "2d",
        deck3DYaw: 28,
        deck3DPitch: 38,
        deckTouchActive: false,
        deckTouchStartX: 0,
        deckTouchStartY: 0,
        deckTouchStartYaw: 28,
        deckTouchStartPitch: 38,
        deck3DLastDrawAt: 0,
        isLoading: false
      };
    },
    computed: {
      currentFloorLabel() {
        return `${this.selectedFloor} 层`;
      },
      validRooms() {
        return this.rooms.filter((room) => Array.isArray(room.boundary_points) && room.boundary_points.length >= 3);
      },
      alarmRooms() {
        return this.rooms.filter((room) => room._isAlarm);
      },
      totalArea() {
        return this.rooms.reduce((sum, room) => sum + (room._metrics ? room._metrics.area : 0), 0);
      }
    },
    methods: {
      onFloorChange(event) {
        const index = Number(event.detail.value || 0);
        this.floorIndex = index;
        this.selectedFloor = FLOOR_OPTIONS[index] || 1;
        this.loadRoomMaps(false);
      },
      async loadRoomMaps(showToast = false) {
        if (this.isLoading) {
          return;
        }
        this.isLoading = true;
        this.statusText = `正在加载第 ${this.selectedFloor} 层房间地图...`;
        this.isStatusError = false;
        try {
          const response = await uni.request({
            url: `${this.roomMapApi}?floor_no=${this.selectedFloor}`,
            method: "GET",
            timeout: 12e3,
            header: {
              Accept: "application/json"
            }
          });
          const payload = response && response.data ? response.data : null;
          if (!payload || payload.status !== "success" || !Array.isArray(payload.data)) {
            throw new Error(payload && payload.message || "接口返回格式异常");
          }
          this.selectedFloor = this.normalizeFloor(
            payload.selected_floor !== null && payload.selected_floor !== void 0 ? payload.selected_floor : this.selectedFloor
          );
          this.floorIndex = FLOOR_OPTIONS.indexOf(this.selectedFloor);
          this.rooms = payload.data.map((room, index) => this.normalizeRoom(room, index));
          this.corridorMarkers = this.normalizeMarkers(payload.corridor_markers || []).filter(
            (marker) => this.normalizeFloor(marker.floor_no) === this.selectedFloor
          );
          this.lastUpdateText = payload.timestamp || this.formatDateTime(/* @__PURE__ */ new Date());
          this.statusText = `第 ${this.selectedFloor} 层加载成功，共 ${this.rooms.length} 个房间，报警 ${this.alarmRooms.length} 个`;
          this.isStatusError = false;
          this.$nextTick(() => {
            this.drawDeckMap();
            this.drawAllRoomMaps();
          });
          if (showToast) {
            uni.showToast({
              title: "地图已更新",
              icon: "success",
              duration: 1400
            });
          }
        } catch (error) {
          this.rooms = [];
          this.corridorMarkers = [];
          this.statusText = `加载失败：${error.message || "未知错误"}`;
          this.isStatusError = true;
          this.lastUpdateText = this.formatDateTime(/* @__PURE__ */ new Date());
          this.drawDeckMap();
          this.drawAllRoomMaps();
          if (showToast) {
            uni.showToast({
              title: "加载失败",
              icon: "none",
              duration: 1600
            });
          }
        } finally {
          this.isLoading = false;
        }
      },
      initCanvasSize() {
        const info = uni.getSystemInfoSync();
        const width = Math.max(300, Math.min(720, info.windowWidth - 24));
        this.canvasWidth = width;
        this.canvasHeight = Math.round(width * 0.72);
        this.roomCanvasWidth = Math.max(260, width - 40);
        this.roomCanvasHeight = Math.round(this.roomCanvasWidth * 0.66);
      },
      drawDeckMap() {
        if (this.viewMode === "3d") {
          this.drawDeckMap3D();
          return;
        }
        this.drawDeckMap2D();
      },
      setViewMode(mode) {
        if (mode !== "2d" && mode !== "3d") {
          return;
        }
        this.viewMode = mode;
        if (mode === "3d") {
          uni.showToast({
            title: "单指拖拽可旋转3D",
            icon: "none",
            duration: 1300
          });
        }
        this.$nextTick(() => {
          this.drawDeckMap();
        });
      },
      onDeckTouchStart(event) {
        if (this.viewMode !== "3d") {
          return;
        }
        this.safeStopTouchEvent(event);
        const point = this.extractTouchPoint(event);
        if (!point) {
          return;
        }
        this.deckTouchActive = true;
        this.deckTouchStartX = point.x;
        this.deckTouchStartY = point.y;
        this.deckTouchStartYaw = this.deck3DYaw;
        this.deckTouchStartPitch = this.deck3DPitch;
      },
      onDeckTouchMove(event) {
        if (this.viewMode !== "3d" || !this.deckTouchActive) {
          return;
        }
        this.safeStopTouchEvent(event);
        const point = this.extractTouchPoint(event);
        if (!point) {
          return;
        }
        const deltaX = point.x - this.deckTouchStartX;
        const deltaY = point.y - this.deckTouchStartY;
        this.deck3DYaw = this.normalizeAngle(this.deckTouchStartYaw + deltaX * 0.45);
        this.deck3DPitch = this.clamp(this.deckTouchStartPitch - deltaY * 0.24, 18, 72);
        const now = Date.now();
        if (now - this.deck3DLastDrawAt >= 16) {
          this.deck3DLastDrawAt = now;
          this.drawDeckMap3D();
        }
      },
      onDeckTouchEnd() {
        this.deckTouchActive = false;
      },
      safeStopTouchEvent(event) {
        if (!event || typeof event !== "object") {
          return;
        }
        if (typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
      },
      extractTouchPoint(event) {
        const touches = event && event.touches || [];
        const changedTouches = event && event.changedTouches || [];
        const target = touches[0] || changedTouches[0];
        if (!target) {
          return null;
        }
        return {
          x: Number(
            target.x !== void 0 ? target.x : target.pageX !== void 0 ? target.pageX : target.clientX !== void 0 ? target.clientX : 0
          ),
          y: Number(
            target.y !== void 0 ? target.y : target.pageY !== void 0 ? target.pageY : target.clientY !== void 0 ? target.clientY : 0
          )
        };
      },
      drawDeckMap2D() {
        const ctx = uni.createCanvasContext("deckCanvas", this);
        const width = this.canvasWidth;
        const height = this.canvasHeight;
        ctx.setFillStyle("#0f1724");
        ctx.fillRect(0, 0, width, height);
        const rooms = this.validRooms;
        if (!rooms.length) {
          this.boundsText = "坐标范围：未计算";
          ctx.setFillStyle("#91a8c1");
          ctx.setFontSize(14);
          ctx.fillText("当前楼层暂无可绘制房间", 20, 34);
          ctx.draw();
          return;
        }
        const allPoints = [];
        rooms.forEach((room) => {
          room.boundary_points.forEach((point) => allPoints.push(point));
        });
        const bounds = this.getBounds(allPoints);
        const padding = 28;
        const rangeX = Math.max(bounds.maxX - bounds.minX, 1e-6);
        const rangeY = Math.max(bounds.maxY - bounds.minY, 1e-6);
        const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY);
        const mapX = (x) => padding + (x - bounds.minX) * scale;
        const mapY = (y) => height - padding - (y - bounds.minY) * scale;
        this.drawGrid(ctx, width, height, bounds, mapX, mapY);
        rooms.forEach((room) => {
          this.drawRoomPolygon(ctx, room, mapX, mapY);
        });
        this.corridorMarkers.forEach((marker) => {
          this.drawMarker(ctx, marker, mapX, mapY);
        });
        this.boundsText = `坐标范围：X ${this.trimNum(bounds.minX)} ~ ${this.trimNum(bounds.maxX)} m，Y ${this.trimNum(
          bounds.minY
        )} ~ ${this.trimNum(bounds.maxY)} m`;
        ctx.draw();
      },
      drawDeckMap3D() {
        const ctx = uni.createCanvasContext("deckCanvas", this);
        const width = this.canvasWidth;
        const height = this.canvasHeight;
        ctx.setFillStyle("#0b1320");
        ctx.fillRect(0, 0, width, height);
        const rooms = this.validRooms;
        if (!rooms.length) {
          this.boundsText = "三维范围：未计算";
          ctx.setFillStyle("#91a8c1");
          ctx.setFontSize(14);
          ctx.fillText("当前楼层暂无可绘制房间", 20, 34);
          ctx.draw();
          return;
        }
        const allPoints = [];
        rooms.forEach((room) => {
          room.boundary_points.forEach((point) => allPoints.push(point));
        });
        const bounds = this.getBounds(allPoints);
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const rangeX = Math.max(bounds.maxX - bounds.minX, 1e-6);
        const rangeY = Math.max(bounds.maxY - bounds.minY, 1e-6);
        const baseScale = Math.min(width * 0.52 / rangeX, height * 0.4 / rangeY);
        const yawRad = this.deck3DYaw * Math.PI / 180;
        const pitchRad = this.deck3DPitch * Math.PI / 180;
        const cosYaw = Math.cos(yawRad);
        const sinYaw = Math.sin(yawRad);
        const depthX = Math.cos(pitchRad) * 0.72;
        const depthY = Math.sin(pitchRad) * 0.72;
        const heightScale = Math.max(8, baseScale * 0.9);
        const originX = width / 2;
        const originY = height * 0.86;
        const projectPoint = (x, y, z) => {
          const nx = (x - centerX) * baseScale;
          const ny = (y - centerY) * baseScale;
          const rx = nx * cosYaw - ny * sinYaw;
          const ry = nx * sinYaw + ny * cosYaw;
          return {
            x: originX + rx + ry * depthX,
            y: originY - ry * depthY - z * heightScale
          };
        };
        ctx.setStrokeStyle("rgba(115, 146, 183, 0.28)");
        ctx.setLineWidth(1);
        for (let i = -4; i <= 4; i += 1) {
          const p1 = projectPoint(bounds.minX - rangeX * 0.2, centerY + i * rangeY / 6, 0);
          const p2 = projectPoint(bounds.maxX + rangeX * 0.2, centerY + i * rangeY / 6, 0);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        const sortedRooms = [...rooms].sort((left, right) => {
          const leftAnchor = this.getLabelAnchor(left.boundary_points || []);
          const rightAnchor = this.getLabelAnchor(right.boundary_points || []);
          const leftNx = leftAnchor.x - centerX;
          const leftNy = leftAnchor.y - centerY;
          const rightNx = rightAnchor.x - centerX;
          const rightNy = rightAnchor.y - centerY;
          const leftDepth = leftNx * sinYaw + leftNy * cosYaw;
          const rightDepth = rightNx * sinYaw + rightNy * cosYaw;
          return rightDepth - leftDepth;
        });
        sortedRooms.forEach((room) => {
          this.drawRoomPrism(ctx, room, projectPoint);
        });
        this.corridorMarkers.forEach((marker) => {
          this.drawMarker3D(ctx, marker, projectPoint);
        });
        const maxHeight = sortedRooms.reduce((max, room) => Math.max(max, Number(room.height_m || 3)), 0);
        this.boundsText = `三维范围：X ${this.trimNum(bounds.minX)} ~ ${this.trimNum(bounds.maxX)} m，Y ${this.trimNum(
          bounds.minY
        )} ~ ${this.trimNum(bounds.maxY)} m，Z 0 ~ ${this.trimNum(maxHeight)} m`;
        ctx.setFillStyle("rgba(12, 24, 38, 0.78)");
        ctx.fillRect(width - 196, 10, 186, 22);
        ctx.setFillStyle("#d8edff");
        ctx.setFontSize(10);
        ctx.fillText(`3D视图: 偏航${this.trimNum(this.deck3DYaw)}° 俯仰${this.trimNum(this.deck3DPitch)}°`, width - 188, 25);
        ctx.draw();
      },
      drawRoomPrism(ctx, room, projectPoint) {
        const points = room.boundary_points || [];
        if (points.length < 3) {
          return;
        }
        const roomHeight = Math.max(Number(room.height_m || 3), 0.1);
        const style = this.getRoomStyle(room);
        const topPoints = points.map((point) => projectPoint(point.x, point.y, roomHeight));
        const basePoints = points.map((point) => projectPoint(point.x, point.y, 0));
        const sideColor = this.shadeColor(style.color, -0.3);
        const topColor = this.shadeColor(style.color, 0.12);
        for (let i = 0; i < points.length; i += 1) {
          const next = (i + 1) % points.length;
          const quad = [basePoints[i], basePoints[next], topPoints[next], topPoints[i]];
          ctx.beginPath();
          ctx.moveTo(quad[0].x, quad[0].y);
          for (let k = 1; k < quad.length; k += 1) {
            ctx.lineTo(quad[k].x, quad[k].y);
          }
          ctx.closePath();
          ctx.setFillStyle(this.hexToRgba(sideColor, 0.72));
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length; i += 1) {
          ctx.lineTo(topPoints[i].x, topPoints[i].y);
        }
        ctx.closePath();
        ctx.setFillStyle(this.hexToRgba(topColor, 0.9));
        ctx.fill();
        ctx.setStrokeStyle(room._isAlarm ? "#ffd3d3" : "#d7ecff");
        ctx.setLineWidth(room._isAlarm ? 2.2 : 1.5);
        ctx.stroke();
        const anchor = this.getLabelAnchor(points);
        const textPoint = projectPoint(anchor.x, anchor.y, roomHeight + 0.2);
        ctx.setFillStyle(room._isAlarm ? "#ffdede" : "#e6f3ff");
        ctx.setFontSize(10);
        const label = `${room.room_name || "房间"} ${room.room_id}`;
        ctx.fillText(label.length > 10 ? `${label.slice(0, 9)}...` : label, textPoint.x - 28, textPoint.y - 4);
      },
      drawMarker3D(ctx, marker, projectPoint) {
        const base = projectPoint(marker.x, marker.y, 0.2);
        const rad = Number(marker.direction_deg || 0) * Math.PI / 180;
        const point2 = projectPoint(marker.x + Math.sin(rad) * 0.75, marker.y - Math.cos(rad) * 0.75, 0.2);
        const tipX = point2.x;
        const tipY = point2.y;
        ctx.beginPath();
        ctx.setFillStyle("rgba(74, 163, 255, 0.95)");
        ctx.arc(base.x, base.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.setStrokeStyle("#f2f8ff");
        ctx.setLineWidth(1.2);
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      },
      drawGrid(ctx, width, height, bounds, mapX, mapY) {
        const step = this.niceStep(Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 5 || 1);
        ctx.setStrokeStyle("rgba(110, 148, 189, 0.22)");
        ctx.setLineWidth(1);
        for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX + step * 0.4; x += step) {
          const px = mapX(x);
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, height);
          ctx.stroke();
        }
        for (let y = Math.floor(bounds.minY / step) * step; y <= bounds.maxY + step * 0.4; y += step) {
          const py = mapY(y);
          ctx.beginPath();
          ctx.moveTo(0, py);
          ctx.lineTo(width, py);
          ctx.stroke();
        }
      },
      drawRoomPolygon(ctx, room, mapX, mapY) {
        const points = room.boundary_points || [];
        if (points.length < 3) {
          return;
        }
        const style = this.getRoomStyle(room);
        const plotted = points.map((point) => ({ x: mapX(point.x), y: mapY(point.y) }));
        ctx.beginPath();
        ctx.moveTo(plotted[0].x, plotted[0].y);
        for (let i = 1; i < plotted.length; i += 1) {
          ctx.lineTo(plotted[i].x, plotted[i].y);
        }
        ctx.closePath();
        ctx.setFillStyle(this.hexToRgba(style.color, style.fillOpacity));
        ctx.fill();
        ctx.setStrokeStyle(style.color);
        ctx.setLineWidth(style.lineWidth);
        ctx.stroke();
        const anchor = this.getLabelAnchor(points);
        const lx = mapX(anchor.x);
        const ly = mapY(anchor.y);
        const title = `${room.room_name || "房间"} ${room.room_id}`;
        ctx.setFillStyle(room._isAlarm ? "rgba(72, 22, 22, 0.9)" : "rgba(14, 26, 40, 0.88)");
        ctx.fillRect(lx - 36, ly - 11, 72, 20);
        ctx.setFillStyle(room._isAlarm ? "#ffe5e5" : "#e6f3ff");
        ctx.setFontSize(10);
        ctx.fillText(title.length > 10 ? `${title.slice(0, 9)}...` : title, lx - 32, ly + 3);
      },
      drawMarker(ctx, marker, mapX, mapY) {
        const x = mapX(marker.x);
        const y = mapY(marker.y);
        const rad = Number(marker.direction_deg || 0) * Math.PI / 180;
        const dx = Math.sin(rad) * 10;
        const dy = -Math.cos(rad) * 10;
        ctx.beginPath();
        ctx.setFillStyle("rgba(78, 185, 254, 0.9)");
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.setStrokeStyle("#d8f0ff");
        ctx.setLineWidth(1.5);
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();
      },
      drawAllRoomMaps() {
        this.rooms.forEach((room) => {
          this.drawRoomMap(room);
        });
      },
      drawRoomMap(room) {
        if (!room || !room._canvasId) {
          return;
        }
        const points = Array.isArray(room.boundary_points) ? room.boundary_points : [];
        const width = this.roomCanvasWidth;
        const height = this.roomCanvasHeight;
        const ctx = uni.createCanvasContext(room._canvasId, this);
        ctx.setFillStyle("#0f1a29");
        ctx.fillRect(0, 0, width, height);
        if (points.length < 3) {
          ctx.setFillStyle("#8ca3b8");
          ctx.setFontSize(13);
          ctx.fillText("边界点不足，无法绘制房间", 14, 26);
          ctx.draw();
          return;
        }
        const bounds = this.getBounds(points);
        const padding = 24;
        const rangeX = Math.max(bounds.maxX - bounds.minX, 1e-6);
        const rangeY = Math.max(bounds.maxY - bounds.minY, 1e-6);
        const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY);
        const mapX = (x) => padding + (x - bounds.minX) * scale;
        const mapY = (y) => height - padding - (y - bounds.minY) * scale;
        const style = this.getRoomStyle(room);
        this.drawGrid(ctx, width, height, bounds, mapX, mapY);
        this.drawRoomPolygon(ctx, room, mapX, mapY);
        points.forEach((point, index) => {
          const x = mapX(point.x);
          const y = mapY(point.y);
          ctx.beginPath();
          ctx.setFillStyle(style.color);
          ctx.arc(x, y, 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.setStrokeStyle("#ffffff");
          ctx.setLineWidth(1.2);
          ctx.arc(x, y, 3.8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setFillStyle("#dbeeff");
          ctx.setFontSize(10);
          ctx.fillText(`P${index + 1}`, x + 6, y - 5);
          this.drawPointCoordinateTag(ctx, x + 6, y + 12, point);
        });
        ctx.draw();
      },
      drawPointCoordinateTag(ctx, x, y, point) {
        if (!point) {
          return;
        }
        const text = `(${this.trimNum(point.x)}, ${this.trimNum(point.y)})`;
        const width = Math.max(74, text.length * 5.8 + 10);
        ctx.setFillStyle("rgba(10, 18, 29, 0.78)");
        ctx.fillRect(x - 2, y - 10, width, 16);
        ctx.setStrokeStyle("rgba(112, 155, 201, 0.35)");
        ctx.setLineWidth(1);
        ctx.strokeRect(x - 2, y - 10, width, 16);
        ctx.setFillStyle("#d9eeff");
        ctx.setFontSize(9);
        ctx.fillText(text, x + 2, y + 1);
      },
      normalizeRoom(room, index) {
        const points = this.normalizePoints(Array.isArray(room.boundary_points) ? room.boundary_points : []);
        const area = room.metrics && typeof room.metrics.area_m2 === "number" ? room.metrics.area_m2 : this.polygonArea(points);
        const perimeter = room.metrics && typeof room.metrics.perimeter_m === "number" ? room.metrics.perimeter_m : this.polygonPerimeter(points);
        const height = Number(room.height_m || 3);
        const volume = room.metrics && typeof room.metrics.volume_m3 === "number" ? room.metrics.volume_m3 : area * height;
        return {
          ...room,
          boundary_points: points,
          _index: index,
          _canvasId: `roomCanvas-${room.room_id || index}`,
          _isAlarm: this.isAlarmRoom(room),
          _metrics: {
            area,
            perimeter,
            volume
          }
        };
      },
      normalizePoints(points) {
        return points.map((point) => ({
          x: Number(point.x),
          y: Number(point.y)
        })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      },
      normalizeMarkers(markers) {
        if (!Array.isArray(markers)) {
          return [];
        }
        return markers.map((marker) => ({
          floor_no: this.normalizeFloor(marker.floor_no),
          marker_type: String(marker.marker_type || "exit"),
          marker_label: String(marker.marker_label || ""),
          x: Number(marker.x),
          y: Number(marker.y),
          direction_deg: Number(marker.direction_deg || 0)
        })).filter((marker) => Number.isFinite(marker.x) && Number.isFinite(marker.y));
      },
      normalizeFloor(floor) {
        const value = Number(floor);
        return FLOOR_OPTIONS.includes(value) ? value : 1;
      },
      isAlarmRoom(room) {
        if (!room || typeof room !== "object") {
          return false;
        }
        if (room.is_alarm === true || room.is_alarm === 1) {
          return true;
        }
        const alarmCount = Number(room.alarm_device_count || 0);
        if (Number.isFinite(alarmCount) && alarmCount > 0) {
          return true;
        }
        return /报警|告警|alarm/i.test(String(room.alarm_status || room.status || ""));
      },
      isCorridorName(name2) {
        return /走廊|通道|corridor/i.test(String(name2 || ""));
      },
      getRoomStyle(room) {
        if (room._isAlarm) {
          return {
            color: ALARM_COLOR,
            fillOpacity: 0.35,
            lineWidth: 2.4
          };
        }
        if (this.isCorridorName(room.room_name)) {
          return {
            color: CORRIDOR_COLOR,
            fillOpacity: 0.14,
            lineWidth: 1.8
          };
        }
        return {
          color: ROOM_COLORS[room._index % ROOM_COLORS.length],
          fillOpacity: 0.24,
          lineWidth: 2
        };
      },
      getBounds(points) {
        const first = points[0] || { x: 0, y: 0 };
        let minX = first.x;
        let maxX = first.x;
        let minY = first.y;
        let maxY = first.y;
        points.forEach((point) => {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        });
        return {
          minX,
          maxX,
          minY,
          maxY
        };
      },
      getLabelAnchor(points) {
        const bounds = this.getBounds(points);
        return {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2
        };
      },
      polygonArea(points) {
        if (points.length < 3) {
          return 0;
        }
        let sum = 0;
        for (let i = 0; i < points.length; i += 1) {
          const j = (i + 1) % points.length;
          sum += points[i].x * points[j].y - points[j].x * points[i].y;
        }
        return Math.abs(sum) / 2;
      },
      polygonPerimeter(points) {
        if (points.length < 2) {
          return 0;
        }
        let sum = 0;
        for (let i = 0; i < points.length; i += 1) {
          const j = (i + 1) % points.length;
          sum += Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        }
        return sum;
      },
      niceStep(value) {
        if (!Number.isFinite(value) || value <= 0) {
          return 1;
        }
        const exponent = Math.floor(Math.log10(value));
        const fraction = value / Math.pow(10, exponent);
        if (fraction <= 1) {
          return Math.pow(10, exponent);
        }
        if (fraction <= 2) {
          return 2 * Math.pow(10, exponent);
        }
        if (fraction <= 5) {
          return 5 * Math.pow(10, exponent);
        }
        return 10 * Math.pow(10, exponent);
      },
      hexToRgba(hex, alpha) {
        const value = String(hex || "#000000").replace("#", "");
        const normalized = value.length === 3 ? value.split("").map((ch) => `${ch}${ch}`).join("") : value.padEnd(6, "0").slice(0, 6);
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        const a = Number(alpha);
        return `rgba(${r}, ${g}, ${b}, ${Number.isFinite(a) ? a : 1})`;
      },
      shadeColor(hex, amount) {
        const value = String(hex || "#000000").replace("#", "");
        const normalized = value.length === 3 ? value.split("").map((ch) => `${ch}${ch}`).join("") : value.padEnd(6, "0").slice(0, 6);
        const ratio = Math.max(-1, Math.min(1, Number(amount) || 0));
        const channel = (start) => {
          const base = parseInt(normalized.slice(start, start + 2), 16);
          const target = ratio >= 0 ? 255 : 0;
          const mixed = Math.round(base + (target - base) * Math.abs(ratio));
          return mixed.toString(16).padStart(2, "0");
        };
        return `#${channel(0)}${channel(2)}${channel(4)}`;
      },
      normalizeAngle(value) {
        if (!Number.isFinite(value)) {
          return 0;
        }
        let angle = value % 360;
        if (angle < 0) {
          angle += 360;
        }
        return angle;
      },
      clamp(value, min, max) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          return min;
        }
        return Math.max(min, Math.min(max, numeric));
      },
      trimNum(value) {
        return Number(value || 0).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
      },
      formatNum(value) {
        return Number(value || 0).toFixed(2);
      },
      formatDateTime(time) {
        const date = new Date(time);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hour = String(date.getHours()).padStart(2, "0");
        const minute = String(date.getMinutes()).padStart(2, "0");
        const second = String(date.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      },
      startAutoRefresh() {
        if (this.autoRefreshTimer) {
          clearInterval(this.autoRefreshTimer);
        }
        this.autoRefreshTimer = setInterval(() => {
          this.loadRoomMaps(false);
        }, AUTO_REFRESH_MS);
      },
      stopAutoRefresh() {
        if (this.autoRefreshTimer) {
          clearInterval(this.autoRefreshTimer);
          this.autoRefreshTimer = null;
        }
      }
    },
    onLoad() {
      this.initCanvasSize();
      this.loadRoomMaps(false);
      this.startAutoRefresh();
    },
    onShow() {
      this.startAutoRefresh();
      this.$nextTick(() => {
        this.drawDeckMap();
        this.drawAllRoomMaps();
      });
    },
    onHide() {
      this.stopAutoRefresh();
    },
    onUnload() {
      this.stopAutoRefresh();
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "toolbar" }, [
        vue.createElementVNode("view", { class: "toolbar-left" }, [
          vue.createElementVNode("text", { class: "toolbar-title" }, "房间地图总览"),
          vue.createElementVNode("text", { class: "toolbar-desc" }, "查看楼层房间分布、边界轮廓与报警状态")
        ]),
        vue.createElementVNode("view", { class: "toolbar-actions" }, [
          vue.createElementVNode("picker", {
            range: $data.floorLabels,
            value: $data.floorIndex,
            onChange: _cache[0] || (_cache[0] = (...args) => $options.onFloorChange && $options.onFloorChange(...args))
          }, [
            vue.createElementVNode(
              "view",
              { class: "floor-picker" },
              "楼层：" + vue.toDisplayString($options.currentFloorLabel),
              1
              /* TEXT */
            )
          ], 40, ["range", "value"]),
          vue.createElementVNode("view", {
            class: "refresh-btn",
            onClick: _cache[1] || (_cache[1] = ($event) => $options.loadRoomMaps(true))
          }, "刷新")
        ])
      ]),
      vue.createElementVNode("view", { class: "stats" }, [
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode("text", { class: "stat-label" }, "房间总数"),
          vue.createElementVNode(
            "text",
            { class: "stat-value" },
            vue.toDisplayString($data.rooms.length),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode("text", { class: "stat-label" }, "有效边界房间"),
          vue.createElementVNode(
            "text",
            { class: "stat-value" },
            vue.toDisplayString($options.validRooms.length),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode("text", { class: "stat-label" }, "报警房间"),
          vue.createElementVNode(
            "text",
            { class: "stat-value alarm" },
            vue.toDisplayString($options.alarmRooms.length),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode("text", { class: "stat-label" }, "累计面积"),
          vue.createElementVNode(
            "text",
            { class: "stat-value" },
            vue.toDisplayString($options.formatNum($options.totalArea)) + " m²",
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode(
        "view",
        {
          class: vue.normalizeClass(["status-bar", { error: $data.isStatusError }])
        },
        vue.toDisplayString($data.statusText),
        3
        /* TEXT, CLASS */
      ),
      vue.createElementVNode("view", { class: "deck-card" }, [
        vue.createElementVNode("view", { class: "deck-head" }, [
          vue.createElementVNode(
            "text",
            { class: "deck-title" },
            vue.toDisplayString($options.currentFloorLabel) + " 甲板图",
            1
            /* TEXT */
          ),
          vue.createElementVNode("view", { class: "deck-head-right" }, [
            vue.createElementVNode("view", { class: "view-switch" }, [
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["view-btn", { active: $data.viewMode === "2d" }]),
                  onClick: _cache[2] || (_cache[2] = ($event) => $options.setViewMode("2d"))
                },
                "2D",
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["view-btn", { active: $data.viewMode === "3d" }]),
                  onClick: _cache[3] || (_cache[3] = ($event) => $options.setViewMode("3d"))
                },
                "3D",
                2
                /* CLASS */
              )
            ]),
            vue.createElementVNode(
              "text",
              { class: "deck-meta" },
              "更新时间：" + vue.toDisplayString($data.lastUpdateText),
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createElementVNode(
          "canvas",
          {
            "canvas-id": "deckCanvas",
            class: "deck-canvas",
            style: vue.normalizeStyle({ width: $data.canvasWidth + "px", height: $data.canvasHeight + "px" }),
            onTouchstart: _cache[4] || (_cache[4] = (...args) => $options.onDeckTouchStart && $options.onDeckTouchStart(...args)),
            onTouchmove: _cache[5] || (_cache[5] = (...args) => $options.onDeckTouchMove && $options.onDeckTouchMove(...args)),
            onTouchend: _cache[6] || (_cache[6] = (...args) => $options.onDeckTouchEnd && $options.onDeckTouchEnd(...args)),
            onTouchcancel: _cache[7] || (_cache[7] = (...args) => $options.onDeckTouchEnd && $options.onDeckTouchEnd(...args))
          },
          null,
          36
          /* STYLE, NEED_HYDRATION */
        ),
        vue.createElementVNode(
          "text",
          { class: "deck-bounds" },
          vue.toDisplayString($data.boundsText),
          1
          /* TEXT */
        )
      ]),
      vue.createElementVNode("view", { class: "room-list" }, [
        !$data.rooms.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty"
        }, "当前楼层暂无房间地图数据")) : vue.createCommentVNode("v-if", true),
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.rooms, (room) => {
            return vue.openBlock(), vue.createElementBlock(
              "view",
              {
                key: room.room_id,
                class: vue.normalizeClass(["room-card", { alarm: room._isAlarm }])
              },
              [
                vue.createElementVNode("view", { class: "room-head" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "room-name" },
                    vue.toDisplayString(room.room_name || "房间" + room.room_id),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    {
                      class: vue.normalizeClass(["room-status", { alarm: room._isAlarm }])
                    },
                    vue.toDisplayString(room._isAlarm ? "报警中" : "正常"),
                    3
                    /* TEXT, CLASS */
                  )
                ]),
                vue.createElementVNode(
                  "text",
                  { class: "room-id" },
                  "房间ID：" + vue.toDisplayString(room.room_id) + " | 楼层：" + vue.toDisplayString(room.floor_no || $data.selectedFloor),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("view", { class: "metrics" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "metric" },
                    "面积 " + vue.toDisplayString($options.formatNum(room._metrics.area)) + " m²",
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "metric" },
                    "周长 " + vue.toDisplayString($options.formatNum(room._metrics.perimeter)) + " m",
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "metric" },
                    "体积 " + vue.toDisplayString($options.formatNum(room._metrics.volume)) + " m³",
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("canvas", {
                  "canvas-id": room._canvasId,
                  class: "room-canvas",
                  style: vue.normalizeStyle({ width: $data.roomCanvasWidth + "px", height: $data.roomCanvasHeight + "px" })
                }, null, 12, ["canvas-id"]),
                vue.createElementVNode("view", { class: "point-list" }, [
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList(room.boundary_points, (point, pointIndex) => {
                      return vue.openBlock(), vue.createElementBlock("view", {
                        key: pointIndex,
                        class: "point-item"
                      }, [
                        vue.createElementVNode(
                          "text",
                          { class: "point-name" },
                          "P" + vue.toDisplayString(pointIndex + 1),
                          1
                          /* TEXT */
                        ),
                        vue.createElementVNode(
                          "text",
                          { class: "point-value" },
                          "(" + vue.toDisplayString($options.trimNum(point.x)) + ", " + vue.toDisplayString($options.trimNum(point.y)) + ")",
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ],
              2
              /* CLASS */
            );
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])
    ]);
  }
  const PagesRoomMapRoomMap = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-9048a47d"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/roomMap/roomMap.vue"]]);
  const _sfc_main$3 = {
    data() {
      return {
        form: {
          room_code: "",
          handler: "",
          alarm_type: "",
          description: ""
        },
        alarmTypeOptions: ["船舶火灾", "烟雾报警", "温度异常", "设备故障", "误报"],
        roomCodeOptions: [],
        isLoading: false
      };
    },
    onLoad() {
      this.getRoomCodes();
    },
    methods: {
      // 获取舱室编号
      async getRoomCodes() {
        try {
          uni.showLoading({ title: "加载舱室编号..." });
          const res = await uni.request({
            url: API_URLS.GET_ROOM_CODES,
            method: "GET"
          });
          if (res.statusCode === 200) {
            if (res.data.code === 200) {
              this.roomCodeOptions = res.data.data;
            } else {
              uni.showToast({
                title: `获取失败: ${res.data.msg || "未知错误"}`,
                icon: "none",
                duration: 3e3
              });
            }
          } else {
            uni.showToast({
              title: `服务器错误: ${res.statusCode}`,
              icon: "none",
              duration: 3e3
            });
          }
        } catch (err) {
          formatAppLog("error", "at pages/handleInfo/handleInfo.vue:125", "获取舱室编号异常：", err);
          await this.loadRoomCodesFromGetdata();
        } finally {
          uni.hideLoading();
        }
      },
      async loadRoomCodesFromGetdata() {
        try {
          const res = await uni.request({
            url: API_URLS.HANDLE_FALLBACK_GET_DATA,
            method: "GET",
            timeout: 8e3
          });
          if (res.statusCode === 200 && res.data) {
            const source = Array.isArray(res.data.fire_alarm_data) ? res.data.fire_alarm_data : [];
            const rooms = [...new Set(source.filter((item) => item.room_name || item.room_code).map((item) => item.room_name || item.room_code))];
            this.roomCodeOptions = rooms;
            if (rooms.length > 0) {
              uni.showToast({ title: "已切换到兼容数据源", icon: "none", duration: 2e3 });
              return;
            }
          }
          uni.showToast({ title: "网络异常，请检查连接", icon: "none", duration: 3e3 });
        } catch (e) {
          uni.showToast({ title: "网络异常，请检查连接", icon: "none", duration: 3e3 });
        }
      },
      // 提交表单
      async handleSubmit() {
        var _a;
        if (!this.form.room_code) {
          uni.showToast({ title: "请选择舱室编号", icon: "none" });
          return;
        }
        if (!this.form.handler) {
          uni.showToast({ title: "请输入处理人姓名", icon: "none" });
          return;
        }
        if (!this.form.alarm_type) {
          uni.showToast({ title: "请选择或输入报警类型", icon: "none" });
          return;
        }
        try {
          this.isLoading = true;
          uni.showLoading({ title: "处理中..." });
          const saveRes = await uni.request({
            url: API_URLS.SUBMIT_ALARM,
            method: "POST",
            data: this.form
          });
          if (saveRes.statusCode === 200 && saveRes.data.code === 200) {
            const updateRes = await uni.request({
              url: API_URLS.UPDATE_PROCESS_STATUS,
              method: "POST",
              data: {
                room_code: this.form.room_code
              }
            });
            if (updateRes.statusCode === 200) {
              if (updateRes.data.code === 200) {
                uni.showToast({ title: "处理成功，状态已更新", icon: "success", duration: 1500 });
                setTimeout(() => {
                  const pages = getCurrentPages();
                  const currentPage = pages[pages.length - 1];
                  const currentPath = currentPage.route;
                  uni.reLaunch({
                    url: `/${currentPath}`
                  });
                }, 1500);
              } else {
                uni.showToast({
                  title: `状态更新失败: ${updateRes.data.msg || "未知错误"}`,
                  icon: "none",
                  duration: 3e3
                });
                formatAppLog("error", "at pages/handleInfo/handleInfo.vue:214", "状态更新失败详情:", updateRes.data);
              }
            } else {
              uni.showToast({
                title: `服务器错误: ${updateRes.statusCode}`,
                icon: "none",
                duration: 3e3
              });
            }
          } else {
            uni.showToast({
              title: `保存记录失败: ${((_a = saveRes.data) == null ? void 0 : _a.msg) || "未知错误"}`,
              icon: "none",
              duration: 3e3
            });
          }
        } catch (err) {
          formatAppLog("error", "at pages/handleInfo/handleInfo.vue:231", "提交失败：", err);
          uni.showToast({
            title: `操作失败: ${err.message || "网络异常"}`,
            icon: "none",
            duration: 3e3
          });
        } finally {
          this.isLoading = false;
          uni.hideLoading();
        }
      }
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "form-card" }, [
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label required" }, "舱室编号："),
          vue.createElementVNode("picker", {
            mode: "selector",
            range: $data.roomCodeOptions,
            onChange: _cache[0] || (_cache[0] = (e) => $data.form.room_code = $data.roomCodeOptions[e.detail.value])
          }, [
            vue.createElementVNode("view", { class: "picker-view" }, [
              vue.createTextVNode(
                vue.toDisplayString($data.form.room_code || "选择舱室编号") + " ",
                1
                /* TEXT */
              ),
              vue.createElementVNode("text", { class: "icon-arrow" }, "▼")
            ])
          ], 40, ["range"])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label required" }, "处理人："),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              type: "text",
              placeholder: "输入处理人姓名",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.form.handler = $event)
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.handler]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label required" }, "报警类型："),
          vue.createElementVNode("picker", {
            mode: "selector",
            range: $data.alarmTypeOptions,
            onChange: _cache[2] || (_cache[2] = (e) => $data.form.alarm_type = $data.alarmTypeOptions[e.detail.value])
          }, [
            vue.createElementVNode("view", { class: "picker-view" }, [
              vue.createTextVNode(
                vue.toDisplayString($data.form.alarm_type || "选择报警类型") + " ",
                1
                /* TEXT */
              ),
              vue.createElementVNode("text", { class: "icon-arrow" }, "▼")
            ])
          ], 40, ["range"]),
          vue.createElementVNode("view", { class: "input-hint" }, "可直接输入自定义类型"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              type: "text",
              placeholder: "或输入其他报警类型",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.alarm_type = $event)
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.alarm_type]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label required" }, "火灾描述："),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              class: "textarea",
              placeholder: "请详细描述火灾情况、处理过程及结果",
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.form.description = $event)
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.description]
          ])
        ]),
        vue.createElementVNode("button", {
          class: "submit-btn",
          onClick: _cache[5] || (_cache[5] = (...args) => $options.handleSubmit && $options.handleSubmit(...args)),
          loading: $data.isLoading
        }, [
          $data.isLoading ? (vue.openBlock(), vue.createElementBlock(
            vue.Fragment,
            { key: 0 },
            [
              vue.createElementVNode("view", { class: "loading-icon" }),
              vue.createElementVNode("text", null, "处理中...")
            ],
            64
            /* STABLE_FRAGMENT */
          )) : (vue.openBlock(), vue.createElementBlock("text", { key: 1 }, "处理完毕"))
        ], 8, ["loading"])
      ])
    ]);
  }
  const PagesHandleInfoHandleInfo = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-0363a57f"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/handleInfo/handleInfo.vue"]]);
  const _imports_0 = "/static/images/no-data.png";
  const _sfc_main$2 = {
    data() {
      return {
        searchRoomCode: "",
        // 搜索框绑定的值
        allAlarms: [],
        // 存储全部日志数据
        timer: null,
        // 防抖定时器
        isLoading: false,
        apiUrl: API_URLS.GET_ALARMS_LOG
      };
    },
    computed: {
      // 筛选并按处理时间排序后的日志（最新处理的在前）
      filteredAlarms() {
        let filtered = [];
        if (!this.searchRoomCode) {
          filtered = [...this.allAlarms];
        } else {
          filtered = this.allAlarms.filter(
            (item) => item.room_code && item.room_code.includes(this.searchRoomCode)
          );
        }
        return filtered.sort((a, b) => {
          if (!a.triggered_at)
            return 1;
          if (!b.triggered_at)
            return -1;
          const timeA = new Date(a.triggered_at).getTime();
          const timeB = new Date(b.triggered_at).getTime();
          return timeB - timeA;
        });
      }
    },
    onLoad() {
      this.fetchAlarms();
    },
    methods: {
      // 请求后端接口
      fetchAlarms() {
        this.isLoading = true;
        uni.request({
          url: this.apiUrl,
          method: "GET",
          timeout: 8e3,
          data: {
            room_code: this.searchRoomCode
            // 传递搜索参数
          },
          success: (res) => {
            if (res.statusCode === 200) {
              const source = getLatestByRadarId(normalizeTest1Rows(res.data));
              this.allAlarms = source.map((item, index) => ({
                id: item.id || index,
                room_code: item.room_name || item.room_code || "",
                alarm_type: Number(item.Alarm) === 0 ? "火灾报警" : "状态异常",
                description: `温度:${item.temperature_data || "-"} 电量:${item.dl || "-"}%`,
                handler: Number(item.is_processed) === 1 ? "已处理" : "未处理",
                triggered_at: item.time || item.created_at || "",
                handled: Number(item.is_processed) === 1
              }));
            } else {
              uni.showToast({ title: "数据请求失败", icon: "none" });
            }
          },
          fail: (err) => {
            formatAppLog("error", "at pages/processInfo_log/processInfo_log.vue:148", "请求失败：", err);
            this.loadFallbackAlarms();
          },
          complete: () => {
            this.isLoading = false;
          }
        });
      },
      loadFallbackAlarms() {
        uni.request({
          url: API_URLS.GET_DATA,
          method: "GET",
          timeout: 8e3,
          success: (res) => {
            if (res.statusCode !== 200 || !res.data) {
              uni.showToast({ title: "接口不可达，请检查服务", icon: "none" });
              return;
            }
            const source = getLatestByRadarId(normalizeTest1Rows(res.data));
            this.allAlarms = source.map((item, index) => ({
              id: item.id || index,
              room_code: item.room_name || item.room_code || "",
              alarm_type: Number(item.Alarm) === 0 ? "火灾报警" : "状态异常",
              description: `温度:${item.temperature_data || "-"} 电量:${item.dl || "-"}%`,
              handler: Number(item.is_processed) === 1 ? "已处理" : "未处理",
              triggered_at: item.time || item.created_at || "",
              handled: Number(item.is_processed) === 1
            }));
            uni.showToast({ title: "已切换到兼容数据源", icon: "none" });
          },
          fail: (err) => {
            const msg = err && err.errMsg ? err.errMsg : "网络异常";
            uni.showToast({ title: `接口不可达：${msg}`, icon: "none" });
          }
        });
      },
      // 防抖搜索（避免频繁请求）
      debounceSearch() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.fetchAlarms();
        }, 300);
      },
      // 清空搜索
      clearSearch() {
        this.searchRoomCode = "";
        this.fetchAlarms();
      },
      // 格式化时间方法（保留用于可能的扩展）
      formatTime(timeStr) {
        if (!timeStr)
          return "未知时间";
        const date = new Date(timeStr);
        return date.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
      }
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "alarm-log-page" }, [
      vue.createElementVNode("view", { class: "search-container" }, [
        vue.createElementVNode("view", { class: "search-bar" }, [
          vue.createElementVNode("icon", {
            class: "search-icon",
            type: "search",
            size: "18"
          }),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "search-input",
              type: "text",
              placeholder: "输入舱室编号搜索",
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.searchRoomCode = $event),
              onInput: _cache[1] || (_cache[1] = (...args) => $options.debounceSearch && $options.debounceSearch(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.searchRoomCode]
          ]),
          $data.searchRoomCode ? (vue.openBlock(), vue.createElementBlock("button", {
            key: 0,
            class: "clear-btn",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.clearSearch && $options.clearSearch(...args))
          }, [
            vue.createElementVNode("icon", {
              type: "clear",
              size: "16"
            })
          ])) : vue.createCommentVNode("v-if", true)
        ])
      ]),
      vue.createElementVNode("view", { class: "alarm-list" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.filteredAlarms, (item, index) => {
            return vue.openBlock(), vue.createElementBlock(
              "view",
              {
                class: vue.normalizeClass(["alarm-card", { "unhandled": !item.handled }]),
                key: item.id || index
              },
              [
                vue.createElementVNode("view", { class: "card-header" }, [
                  vue.createElementVNode("view", { class: "alarm-type" }, [
                    vue.createElementVNode("text", { class: "type-label" }, "报警类型："),
                    vue.createElementVNode(
                      "text",
                      { class: "type-value" },
                      vue.toDisplayString(item.alarm_type),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                vue.createElementVNode("view", { class: "card-body" }, [
                  vue.createElementVNode("view", { class: "info-row" }, [
                    vue.createElementVNode("text", { class: "info-label" }, "舱室编号："),
                    vue.createElementVNode(
                      "text",
                      { class: "info-value" },
                      vue.toDisplayString(item.room_code),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode("view", { class: "info-row" }, [
                    vue.createElementVNode("text", { class: "info-label" }, "报警描述："),
                    vue.createElementVNode(
                      "text",
                      { class: "info-value" },
                      vue.toDisplayString(item.description || "无描述信息"),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode("view", { class: "info-row" }, [
                    vue.createElementVNode("text", { class: "info-label" }, "处理人："),
                    vue.createElementVNode(
                      "text",
                      { class: "info-value" },
                      vue.toDisplayString(item.handler || "未处理"),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode("view", { class: "info-row" }, [
                    vue.createElementVNode("text", { class: "info-label" }, "处理时间："),
                    vue.createElementVNode(
                      "text",
                      { class: "info-value" },
                      vue.toDisplayString(item.triggered_at || "未处理"),
                      1
                      /* TEXT */
                    )
                  ])
                ])
              ],
              2
              /* CLASS */
            );
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        $options.filteredAlarms.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "no-data"
        }, [
          vue.createElementVNode("image", {
            src: _imports_0,
            mode: "widthFix",
            class: "no-data-img"
          }),
          vue.createElementVNode("text", { class: "no-data-text" }, "暂无相关报警日志")
        ])) : vue.createCommentVNode("v-if", true)
      ])
    ]);
  }
  const PagesProcessInfoLogProcessInfoLog = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-d1d1acb9"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/processInfo_log/processInfo_log.vue"]]);
  const _sfc_main$1 = {
    data() {
      return {
        roomList: [],
        // 所有房间原始数据
        loading: true,
        // 加载状态
        errorMsg: "",
        // 错误信息
        selectedDeck: "all",
        // 选中的甲板（all=全部）
        deckInput: ""
        // 输入的甲板号
      };
    },
    computed: {
      // 根据选中的甲板筛选房间
      filteredRoomList() {
        if (this.selectedDeck === "all") {
          return this.roomList;
        }
        return this.roomList.filter((room) => room.deckNumber === this.selectedDeck);
      }
    },
    onLoad() {
      this.getAllRoomData();
    },
    methods: {
      // 获取所有房间数据（关联甲板号）
      getAllRoomData() {
        this.loading = true;
        this.errorMsg = "";
        uni.request({
          url: API_URLS.PEOPLE_INFO,
          method: "GET",
          success: (res) => {
            this.loading = false;
            const source = getLatestByRadarId(normalizeTest1Rows(res.data));
            this.roomList = source.map((room) => {
              const roomCode = String(room.room_name || room.room_code || "");
              const deckNumber = String(room.deck || room.radar_id || roomCode).charAt(0) || "0";
              return {
                room_code: room.room_name || room.room_code || "",
                device_code: room.device_code || "",
                people_number: room.people_number || 0,
                alarm: Number(room.Alarm) === 0,
                is_processed: Number(room.is_processed) || 0,
                deckNumber
              };
            });
          },
          fail: (err) => {
            this.loading = false;
            this.errorMsg = "网络请求失败，请检查连接";
            formatAppLog("error", "at pages/PeopleNum/PeopleNum.vue:148", "请求失败:", err);
          }
        });
      },
      // 处理甲板号输入：过滤非数字字符
      handleDeckInput(e) {
        let value = e.detail.value;
        this.deckInput = value ? value.replace(/[^\d]/g, "") : "";
      },
      // 应用筛选：根据输入框内容切换筛选状态
      applyFilter() {
        if (!this.deckInput) {
          this.selectedDeck = "all";
          return;
        }
        const targetDeck = this.deckInput;
        this.selectedDeck = targetDeck;
        const hasData = this.roomList.some((room) => room.deckNumber === targetDeck);
        if (!hasData) {
          uni.showToast({ title: `未找到${targetDeck}号甲板数据`, icon: "none" });
        }
      },
      // 清除筛选：快速回到“全部”模式（点击筛选状态旁的“清除”）
      clearFilter() {
        this.deckInput = "";
        this.selectedDeck = "all";
      }
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_uni_loading_icon = vue.resolveComponent("uni-loading-icon");
    const _component_uni_icons = vue.resolveComponent("uni-icons");
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "deck-filter" }, [
        vue.createElementVNode("text", { class: "filter-label" }, "甲板筛选："),
        vue.createElementVNode("view", { class: "filter-input-group" }, [
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              type: "number",
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.deckInput = $event),
              class: "deck-input",
              placeholder: "输入甲板号",
              min: "1",
              onInput: _cache[1] || (_cache[1] = (...args) => $options.handleDeckInput && $options.handleDeckInput(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.deckInput]
          ]),
          vue.createElementVNode("button", {
            class: "filter-btn apply-btn",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.applyFilter && $options.applyFilter(...args))
          }, " 筛选 ")
        ]),
        $data.selectedDeck !== "all" ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "filter-hint"
        }, [
          vue.createTextVNode(
            " 当前筛选：" + vue.toDisplayString($data.selectedDeck) + "号甲板 ",
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", {
            class: "clear-filter",
            onClick: _cache[3] || (_cache[3] = (...args) => $options.clearFilter && $options.clearFilter(...args))
          }, "清除")
        ])) : vue.createCommentVNode("v-if", true)
      ]),
      $data.loading ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "loading"
      }, [
        vue.createVNode(_component_uni_loading_icon, {
          size: "24",
          color: "#007aff"
        }),
        vue.createElementVNode("text", { class: "loading-text" }, "加载中...")
      ])) : vue.createCommentVNode("v-if", true),
      $data.errorMsg ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "error"
      }, [
        vue.createVNode(_component_uni_icons, {
          type: "warn",
          size: "24",
          color: "#ff0000"
        }),
        vue.createElementVNode(
          "text",
          { class: "error-text" },
          vue.toDisplayString($data.errorMsg),
          1
          /* TEXT */
        )
      ])) : vue.createCommentVNode("v-if", true),
      !$data.loading && !$data.errorMsg ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "room-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.filteredRoomList, (room, index) => {
            return vue.openBlock(), vue.createElementBlock(
              "view",
              {
                class: vue.normalizeClass(["room-card", { "alarm-active": room.is_processed === 0 && room.alarm === 1 }]),
                key: index
              },
              [
                vue.createElementVNode("view", { class: "room-code" }, [
                  vue.createElementVNode("text", { class: "label" }, "房间编号："),
                  vue.createElementVNode(
                    "text",
                    { class: "value" },
                    vue.toDisplayString(room.room_code),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "deck-info" },
                    "（" + vue.toDisplayString(room.deckNumber) + "号甲板）",
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "device-code" }, [
                  vue.createElementVNode("text", { class: "label" }, "设备编号："),
                  vue.createElementVNode(
                    "text",
                    { class: "value" },
                    vue.toDisplayString(room.device_code),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "people-count" }, [
                  vue.createElementVNode("text", { class: "label" }, "当前人数："),
                  vue.createElementVNode(
                    "text",
                    { class: "value people-value" },
                    vue.toDisplayString(room.people_number),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", { class: "people-unit" }, "人")
                ]),
                room.is_processed === 0 && room.alarm === 1 ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "status-tag"
                }, [
                  vue.createVNode(_component_uni_icons, {
                    type: "alert",
                    size: "16",
                    color: "#ffffff"
                  }),
                  vue.createElementVNode("text", null, "紧急报警（未处理）")
                ])) : vue.createCommentVNode("v-if", true)
              ],
              2
              /* CLASS */
            );
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        $options.filteredRoomList.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty"
        }, [
          vue.createVNode(_component_uni_icons, {
            type: "empty",
            size: "48",
            color: "#cccccc"
          }),
          vue.createElementVNode(
            "text",
            { class: "empty-text" },
            vue.toDisplayString($data.selectedDeck === "all" ? "暂无房间数据" : "该甲板暂无房间数据"),
            1
            /* TEXT */
          )
        ])) : vue.createCommentVNode("v-if", true)
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesPeopleNumPeopleNum = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-9822f8f0"], ["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/pages/PeopleNum/PeopleNum.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/deviceDeployment/deviceDeployment", PagesDeviceDeploymentDeviceDeployment);
  __definePage("pages/batteryMonitor/batteryMonitor", PagesBatteryMonitorBatteryMonitor);
  __definePage("pages/fireMonitor/fireMonitor", PagesFireMonitorFireMonitor);
  __definePage("pages/roomMap/roomMap", PagesRoomMapRoomMap);
  __definePage("pages/handleInfo/handleInfo", PagesHandleInfoHandleInfo);
  __definePage("pages/processInfo_log/processInfo_log", PagesProcessInfoLogProcessInfoLog);
  __definePage("pages/PeopleNum/PeopleNum", PagesPeopleNumPeopleNum);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:4", "App Launch");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:7", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:10", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "C:/Users/84720/Desktop/Scanning_APP/Scanning_APP/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
