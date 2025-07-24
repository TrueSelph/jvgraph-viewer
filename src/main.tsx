// import { render } from "preact";
import { App } from "./app.tsx";
import register from "preact-custom-element";

register(App, "jvgraph-viewer", ["sessionId"]);

// render(
// 	<App host="http://localhost:8000" root_node="68791bfaaf057b330ac55e15" />,
// 	document.getElementById("app")!,
// );
