import { Plugin } from 'obsidian';

function getHighlightContainer(el: HTMLElement): HTMLElement | null {
	return (el.closest('p, li, blockquote, td, th') as HTMLElement | null) ?? el.parentElement;
}

export default class FloatHighlightsPlugin extends Plugin {
	onload() {
		console.log("loading plugin");

		const highlightObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const target = entry.target as HTMLElement;
				const container = getHighlightContainer(target);
				if (!container) {
					return;
				}

				if (entry.isIntersecting) {
					container.classList.add("float-highlights");
				} else {
					container.classList.remove("float-highlights");
				}
			});
		}, { threshold: 0.2 });

		this.registerMarkdownPostProcessor((element) => {
			const highlightElements = element.querySelectorAll("mark");
			if (highlightElements) {
				Array.from(highlightElements).forEach((el) => {
					const mark = el as HTMLElement;
					if (getHighlightContainer(mark)) {
						highlightObserver.observe(mark);
					}
				});
			}
		});
	}

	onunload() {
		console.log("Unloading plugin")
	}
}
