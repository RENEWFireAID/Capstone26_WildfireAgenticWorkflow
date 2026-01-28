// Store types/interfaces used in the LLMPrompt component

export enum Role { user, ai }

export interface Message {
    src: Role
    msg: string
    key: number
}

export interface AIResponse {
    msg: string
}
