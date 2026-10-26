(function () {
  "use strict";

  const apiBaseUrl =
    window.LEARNING_DEMO_CONFIG?.apiBaseUrl || "http://127.0.0.1:3000";
  const state = { token: "", currentId: "", count: 0, lastAction: "尚未发送" };

  const elements = {
    apiStatus: document.querySelector("#apiStatus"),
    statusDot: document.querySelector("#statusDot"),
    code: document.querySelector("#codeOutput"),
    request: document.querySelector("#requestOutput"),
    response: document.querySelector("#responseOutput"),
    trace: document.querySelector("#traceOutput"),
    duration: document.querySelector("#durationOutput"),
    tokenState: document.querySelector("#tokenState"),
    idState: document.querySelector("#idState"),
    countState: document.querySelector("#countState"),
    lastAction: document.querySelector("#lastAction"),
    knowledgeId: document.querySelector("#knowledgeId"),
    inspector: document.querySelector(".inspector"),
    layout: document.querySelector(".layout"),
    introCard: document.querySelector(".intro-card"),
  };
  const narrowLayout = window.matchMedia("(max-width: 980px)");
  let activeLesson = document.querySelector("#lesson-health");

  const publicTrace = [
    "浏览器事件函数",
    "fetch 发出 HTTP 请求",
    "src/app.js：CORS → JSON 解析",
  ];
  const authTrace = [
    ...publicTrace,
    "src/routes/userRoutes.js：匹配用户路由",
    "src/controllers/userController.js：执行业务步骤",
    "src/validators/userValidator.js：检查输入",
    "src/models/User.js → MongoDB",
    "src/utils/response.js：返回统一 JSON",
  ];
  const knowledgeEntryTrace = [
    ...publicTrace,
    "src/middleware/auth.js：验证 Bearer Token",
    "src/routes/knowledgePointRoutes.js：匹配方法与路径",
  ];

  function knowledgeTrace(...steps) {
    return [...knowledgeEntryTrace, ...steps];
  }

  function value(selector) {
    return document.querySelector(selector).value;
  }

  function maskToken(token) {
    if (!token) return "未登录";
    return token.length > 22
      ? `${token.slice(0, 10)}…${token.slice(-8)}`
      : "已保存（已脱敏）";
  }

  function sanitizeForDisplay(value, key = "") {
    if (key.toLowerCase() === "password") return "••••••••（已脱敏）";
    if (key.toLowerCase() === "token" && typeof value === "string") {
      return maskToken(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeForDisplay(item));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
          childKey,
          sanitizeForDisplay(childValue, childKey),
        ]),
      );
    }
    return value;
  }

  function refreshState() {
    elements.tokenState.textContent = maskToken(state.token);
    elements.idState.textContent = state.currentId || "暂无";
    elements.countState.textContent = String(state.count);
    elements.lastAction.textContent = state.lastAction;
    elements.knowledgeId.value = state.currentId;
  }

  function setBusy(busy) {
    document
      .querySelectorAll("button[data-action]")
      .forEach((button) => (button.disabled = busy));
  }

  function placeInspector(lesson = activeLesson) {
    activeLesson = lesson;
    if (narrowLayout.matches) {
      (lesson || elements.introCard).after(elements.inspector);
    } else {
      elements.layout.append(elements.inspector);
    }
  }

  function showTrace(items) {
    elements.trace.replaceChildren(
      ...items.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      }),
    );
  }

  function displayStatus(ok, message) {
    elements.apiStatus.textContent = message;
    elements.statusDot.className = `status-dot ${ok ? "is-ok" : "is-error"}`;
  }

  function buildFetchCode(
    path,
    method,
    body,
    bodyCode,
    authMode,
    requestBaseUrl,
  ) {
    const lines = [];
    if (body) {
      lines.push(
        `const requestBody = ${bodyCode || JSON.stringify(body, null, 2)};`,
        "",
      );
    }
    lines.push(`const response = await fetch(\`${requestBaseUrl}${path}\`, {`);
    if (method !== "GET") lines.push(`  method: "${method}",`);
    if (body || authMode !== "none") {
      lines.push("  headers: {");
      if (body) lines.push('    "Content-Type": "application/json",');
      if (authMode === "auto") {
        lines.push("    Authorization: `Bearer ${token}`,");
      } else if (authMode === "invalid") {
        lines.push('    Authorization: "Bearer not-a-token",');
      }
      lines.push("  },");
    }
    if (body) lines.push("  body: JSON.stringify(requestBody),");
    lines.push("});", "const result = await response.json();");
    return lines.join("\n");
  }

  async function requestApi({
    label,
    method = "GET",
    path,
    body,
    bodyCode,
    authMode = "none",
    trace = publicTrace,
    requestBaseUrl = apiBaseUrl,
    onSuccess,
  }) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (authMode === "auto" && state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    if (authMode === "invalid") headers.Authorization = "Bearer not-a-token";

    const requestView = {
      method,
      url: `${requestBaseUrl}${path}`,
      headers: {
        ...headers,
        ...(headers.Authorization
          ? {
              Authorization: `Bearer ${maskToken(headers.Authorization.slice(7))}`,
            }
          : {}),
      },
      ...(body ? { body } : {}),
    };

    elements.code.textContent = buildFetchCode(
      path,
      method,
      body,
      bodyCode,
      authMode,
      requestBaseUrl,
    );
    elements.request.textContent = JSON.stringify(
      sanitizeForDisplay(requestView),
      null,
      2,
    );
    elements.response.textContent = "请求已经发出，Promise 正在等待响应…";
    elements.duration.textContent = "等待中";
    showTrace(trace);
    state.lastAction = label;
    refreshState();
    setBusy(true);

    const startedAt = performance.now();
    try {
      const response = await fetch(`${requestBaseUrl}${path}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      let result;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        result = text;
      }

      const elapsed = Math.round(performance.now() - startedAt);
      elements.duration.textContent = `${elapsed} ms`;
      elements.response.textContent = JSON.stringify(
        {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          body: sanitizeForDisplay(result),
        },
        null,
        2,
      );
      displayStatus(
        response.ok,
        response.ok
          ? `收到 ${response.status}，请求成功`
          : `收到 ${response.status}，后端明确拒绝`,
      );
      if (response.ok && onSuccess) onSuccess(result);
      return { response, result };
    } catch (error) {
      const elapsed = Math.round(performance.now() - startedAt);
      elements.duration.textContent = `${elapsed} ms`;
      elements.response.textContent = JSON.stringify(
        {
          status: null,
          ok: false,
          body: {
            success: false,
            error: {
              code: "CLIENT_NETWORK_ERROR",
              message: "浏览器没有收到 HTTP 响应，请检查服务、端口或网络。",
              technicalMessage: error.message,
            },
          },
        },
        null,
        2,
      );
      displayStatus(false, "网络错误：没有收到服务器响应");
      return { error };
    } finally {
      setBusy(false);
      refreshState();
    }
  }

  const actions = {
    health: () =>
      requestApi({
        label: "健康检查",
        path: "/health",
        trace: [...publicTrace, "src/app.js：GET /health → res.json()"],
      }),
    register: () =>
      requestApi({
        label: "注册用户",
        method: "POST",
        path: "/api/users/register",
        body: {
          username: value("#registerUsername"),
          email: value("#registerEmail"),
          password: value("#registerPassword"),
        },
        bodyCode: `{
  username: document.querySelector("#registerUsername").value,
  email: document.querySelector("#registerEmail").value,
  password: document.querySelector("#registerPassword").value,
}`,
        trace: authTrace,
        onSuccess(result) {
          state.token = result.data.token;
          document.querySelector("#loginEmail").value = value("#registerEmail");
          document.querySelector("#loginPassword").value =
            value("#registerPassword");
        },
      }),
    "bad-register": () =>
      requestApi({
        label: "错误注册实验",
        method: "POST",
        path: "/api/users/register",
        body: { username: "a", email: "bad", password: "123" },
        trace: [
          ...publicTrace,
          "src/routes/userRoutes.js：匹配注册路由",
          "src/controllers/userController.js：调用注册校验",
          "src/validators/userValidator.js：发现字段不合法，抛出 AppError",
          "src/middleware/errorHandler.js：返回 400，流程停止",
        ],
      }),
    login: () =>
      requestApi({
        label: "登录",
        method: "POST",
        path: "/api/users/login",
        body: {
          email: value("#loginEmail"),
          password: value("#loginPassword"),
        },
        bodyCode: `{
  email: document.querySelector("#loginEmail").value,
  password: document.querySelector("#loginPassword").value,
}`,
        trace: authTrace,
        onSuccess(result) {
          state.token = result.data.token;
        },
      }),
    "missing-token": () =>
      requestApi({
        label: "缺少 Token",
        path: "/api/knowledge-points",
        trace: [
          ...publicTrace,
          "src/middleware/auth.js：没有找到 Token",
          "src/middleware/errorHandler.js：返回 401，未进入业务路由",
        ],
      }),
    "invalid-token": () =>
      requestApi({
        label: "伪造 Token",
        path: "/api/knowledge-points",
        authMode: "invalid",
        trace: [
          ...publicTrace,
          "src/middleware/auth.js：jwt.verify 发现 Token 无效",
          "src/middleware/errorHandler.js：返回 401，未进入业务路由",
        ],
      }),
    create: () =>
      requestApi({
        label: "创建知识点",
        method: "POST",
        path: "/api/knowledge-points",
        authMode: "auto",
        body: {
          title: value("#knowledgeTitle"),
          content: value("#knowledgeContent"),
          status: "not_started",
          reviewList: false,
        },
        trace: knowledgeTrace(
          "src/controllers/knowledgePointController.js：组织创建数据",
          "src/validators/knowledgePointValidator.js：检查字段",
          "src/models/KnowledgePoint.js → MongoDB：写入文档",
          "src/utils/response.js：返回 201 统一 JSON",
        ),
        onSuccess(result) {
          state.currentId = result.data.knowledgePoint._id;
          state.count += 1;
        },
      }),
    list: () =>
      requestApi({
        label: "查询知识点列表",
        path: "/api/knowledge-points",
        authMode: "auto",
        trace: knowledgeTrace(
          "src/controllers/knowledgePointController.js：按当前用户查询",
          "src/models/KnowledgePoint.js → MongoDB：读取列表",
          "src/utils/response.js：返回 200 统一 JSON",
        ),
        onSuccess(result) {
          state.count = result.data.count;
          if (!state.currentId && result.data.knowledgePoints[0]) {
            state.currentId = result.data.knowledgePoints[0]._id;
          }
        },
      }),
    detail: () => {
      if (!state.currentId) return showMissingId();
      return requestApi({
        label: "查询知识点详情",
        path: `/api/knowledge-points/${state.currentId}`,
        authMode: "auto",
        trace: knowledgeTrace(
          "src/controllers/knowledgePointController.js：校验 ID 与数据归属",
          "src/models/KnowledgePoint.js → MongoDB：读取一条文档",
          "src/utils/response.js：返回 200 统一 JSON",
        ),
      });
    },
    update: () => {
      if (!state.currentId) return showMissingId();
      return requestApi({
        label: "更新知识点",
        method: "PATCH",
        path: `/api/knowledge-points/${state.currentId}`,
        authMode: "auto",
        body: { status: "mastered", reviewList: true },
        trace: knowledgeTrace(
          "src/controllers/knowledgePointController.js：校验 ID 与数据归属",
          "src/validators/knowledgePointValidator.js：检查更新白名单",
          "src/models/KnowledgePoint.js → MongoDB：保存修改",
          "src/utils/response.js：返回 200 统一 JSON",
        ),
      });
    },
    delete: () => {
      if (!state.currentId) return showMissingId();
      return requestApi({
        label: "删除知识点",
        method: "DELETE",
        path: `/api/knowledge-points/${state.currentId}`,
        authMode: "auto",
        trace: knowledgeTrace(
          "src/controllers/knowledgePointController.js：校验 ID 与数据归属",
          "src/models/KnowledgePoint.js → MongoDB：删除文档",
          "src/utils/response.js：返回 200 统一 JSON",
        ),
        onSuccess() {
          state.currentId = "";
          state.count = Math.max(0, state.count - 1);
        },
      });
    },
    "wrong-route": () =>
      requestApi({
        label: "错误路径实验",
        path: "/api/not-exists",
        trace: [
          ...publicTrace,
          "src/app.js：没有任何路由匹配",
          "src/middleware/errorHandler.js：notFound 返回 404",
        ],
      }),
    offline: () =>
      requestApi({
        label: "后端离线实验",
        path: "/health",
        requestBaseUrl: "http://127.0.0.1:1",
        trace: [
          "浏览器事件函数",
          "fetch 尝试建立连接",
          "端口 1 没有教学 API",
          "请求没有进入 Express，浏览器抛出网络错误",
        ],
      }),
  };

  function showMissingId() {
    state.lastAction = "缺少知识点 ID";
    elements.response.textContent = JSON.stringify(
      {
        success: false,
        error: {
          code: "CLIENT_STATE_MISSING",
          message:
            "请先在第 5 关创建知识点。这个错误发生在浏览器，没有请求后端。",
        },
      },
      2,
    );
    showTrace([
      "浏览器检查页面状态",
      "没有当前知识点 ID",
      "停止：未发送 HTTP 请求",
    ]);
    displayStatus(false, "页面状态不足：请求未发出");
    refreshState();
  }

  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const lesson = button.closest(".lesson-card");
      await actions[button.dataset.action]();
      placeInspector(lesson);
      if (narrowLayout.matches) {
        elements.inspector.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  narrowLayout.addEventListener("change", () => placeInspector());
  placeInspector();
  refreshState();
})();
