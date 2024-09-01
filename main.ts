const basePath = (app.vault.adapter as any).basePath;

import * as dotenv from "dotenv";
dotenv.config({
	path: `${basePath}/.obsidian/plugins/openai-webclipper/.env`,
	debug: false,
});

import { Plugin, App, Modal, Setting } from "obsidian";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const Webclipper = z.object({
	title: z.string(),
	summary: z.string(),
	keywords: z.array(z.string()),
});

export class URLModal extends Modal {
	result: string;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "What's your name?" });

		new Setting(contentEl).setName("Name").addText((text) =>
			text.onChange((value) => {
				this.result = value;
			})
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Submit")
				.setCta()
				.onClick(() => {
					this.close();
					const openai = new OpenAI({
						apiKey: process.env.OPENAI_API_KEY,
						dangerouslyAllowBrowser: true,
					});

					const completion = openai.chat.completions
						.create({
							model: "gpt-4o-mini",
							messages: [
								{
									role: "system",
									content: "You are a helpful assistant.",
								},
								{
									role: "user",
									content: `
									1. Provide a brief description of the website: ${this.result}
									2. List 5 keywords relevant to the website.
									3. Suggest a title for an article about this website.
									Format the answer using json
									`,
								},
							],
							response_format: zodResponseFormat(
								Webclipper,
								"event"
							),
						})
						.then((completion) => {
							// const regex = /\{([^{}]*)\}/g;
							const resp = completion.choices[0].message.content;
							if (resp) {
								const jsonResp = JSON.parse(resp);
								const { title, summary, keywords } = jsonResp;
								this.app.vault.create(
									`Webclip - ${title.replace(
										/[\/:\\]/g,
										"-"
									)}.md`,
									`
[Link](${this.result}) \n
## Summary \n
${summary} \n
\n
## Keywords \n
${keywords
	.map((i) => "#" + i.replace(/\s+/g, ""))
	.reduce((acc, val) => acc + " " + val)}										`
								);
							}
						});
				})
		);
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

export default class OpenAIWebclipper extends Plugin {
	statusBarElement: HTMLSpanElement;

	async onload() {
		this.addCommand({
			id: "webclip-url",
			name: "Webclip URL",
			callback: () => {
				new URLModal(this.app).open();
			},
		});
	}
}
