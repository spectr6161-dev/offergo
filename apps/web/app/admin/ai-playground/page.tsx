import {
  aiImageModels,
  aiSpeechModels,
  aiTextModels,
  aiTtsVoices,
} from "@offergo/ai";

import { AiPlaygroundClient } from "./ai-playground-client";

export default function AdminAiPlaygroundPage() {
  return (
    <AiPlaygroundClient
      imageModels={[...aiImageModels]}
      speechModels={[...aiSpeechModels]}
      textModels={[...aiTextModels]}
      voices={[...aiTtsVoices]}
    />
  );
}
