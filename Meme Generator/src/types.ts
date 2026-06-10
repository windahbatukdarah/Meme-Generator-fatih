export interface MemeCaption {
  topText: string;
  bottomText: string;
}

export interface MemeTemplate {
  id: string;
  url: string;
  name: string;
}

export interface DraggableText {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  rotation?: number;
  rotateX?: number;
  rotateY?: number;
}

export interface DraggableImage {
  id: string;
  url: string;
  width: number;
  height: number;
  rotation?: number;
  rotateX?: number;
  rotateY?: number;
}
