import { Injectable, OnModuleInit } from '@nestjs/common';
import * as faceapi from '@vladmandic/face-api';
import * as canvas from 'canvas';
import * as path from 'path';

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData } as any);

@Injectable()
export class FaceRecognitionService implements OnModuleInit {
  private modelsLoaded = false;

  async onModuleInit() {
    const modelPath = path.join(__dirname, 'models');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    this.modelsLoaded = true;
  }

  async recognizeFacesFromUrls(urlImageReference: string, urlImage: string) {
    if (!this.modelsLoaded) {
      throw new Error('Face recognition models not loaded');
    }
    const referenceBuffer = await this.fetchImageBuffer(urlImageReference);
    const targetBuffer = await this.fetchImageBuffer(urlImage);

    const referenceDescriptor = await this.recognizeFace(referenceBuffer);
    const targetDescriptor = await this.recognizeFace(targetBuffer);

    if (!referenceDescriptor || !targetDescriptor) {
      return {
        match: false,
        message: 'Face not detected in one or both images',
      };
    }

    const distance = this.euclideanDistance(
      referenceDescriptor,
      targetDescriptor,
    );
    const threshold = 0.6;

    return {
      match: distance < threshold,
      distance,
    };
  }

  private async fetchImageBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async recognizeFace(imageBuffer: Buffer) {
    const img = await canvas.loadImage(imageBuffer);
    const detection = await faceapi
      .detectSingleFace(img as any)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) {
      return null;
    }
    return detection.descriptor;
  }

  private euclideanDistance(desc1: Float32Array, desc2: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
      const diff = desc1[i] - desc2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}
