import { useIDEStore } from "../../store/useIDEStore";

const EDITOR_CHANNEL = "noka-ide-editor-actions";

export const undo = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("undo");
  bc.close();
};

export const redo = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("redo");
  bc.close();
};

export const cut = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("cut");
  bc.close();
};

export const copy = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("copy");
  bc.close();
};

export const paste = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("paste");
  bc.close();
};

export const find = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("find");
  bc.close();
};

export const replace = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("replace");
  bc.close();
};

export const findInFiles = () => {
  const { setActivePanel } = useIDEStore.getState();
  setActivePanel("search");
};

export const replaceInFiles = () => {
  const bc = new BroadcastChannel(EDITOR_CHANNEL);
  bc.postMessage("replaceInFiles");
  bc.close();
  const { setActivePanel } = useIDEStore.getState();
  setActivePanel("search");
};
