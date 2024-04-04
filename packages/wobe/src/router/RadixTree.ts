import type { HttpMethod } from '../Wobe'

export interface Node {
	name: string
	children: Array<Node>
	handler?: (...args: any[]) => Promise<any> | any
	method?: HttpMethod
	isParameterNode?: boolean
	isWildcardNode?: boolean
}

export class RadixTree {
	public root: Node = { name: '/', children: [] }

	constructor() {}

	addRoute(
		method: HttpMethod,
		path: string,
		handler: (...args: any[]) => Promise<any>,
	) {
		const pathParts = path.split('/').filter(Boolean)

		let currentNode = this.root

		for (let i = 0; i < pathParts.length; i++) {
			const pathPart = pathParts[i]
			const isParameterNode = pathPart[0] === ':'
			const isWildcardNode = pathPart[0] === '*'

			let foundNode = currentNode.children.find(
				(node) =>
					node.name === (i === 0 ? '' : '/') + pathPart &&
					(node.method === method || !node.method),
			)

			if (!foundNode) {
				foundNode = {
					name: (i === 0 ? '' : '/') + pathPart,
					children: [],
					isParameterNode,
					isWildcardNode,
				}

				currentNode.children.push(foundNode)
			}

			currentNode = foundNode
		}

		currentNode.handler = handler
		currentNode.method = method
	}

	// This function is used to find the route in the tree
	// The path in the node could be for example /a and in children /simple
	// or it can also be /a/simple/route if there is only one children in each node
	findRoute(method: HttpMethod, path: string) {
		if (path[0] !== '/') path = '/' + path

		const { length: pathLength } = path

		if (pathLength === 1 && path === '/') return this.root

		let nextIndexToEnd = 0

		const isNodeMatch = (
			node: Node,
			indexToBegin: number,
			indexToEnd: number,
		): Node | null => {
			const nextIndexToBegin = indexToBegin + (indexToEnd - indexToBegin)

			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i]

				const isChildWildcardOrParameterNode =
					child.isWildcardNode || child.isParameterNode

				// We get the next end index
				nextIndexToEnd = path.indexOf(
					'/',
					isChildWildcardOrParameterNode
						? nextIndexToBegin + 1
						: nextIndexToBegin + child.name.length - 1,
				)

				if (nextIndexToEnd === -1) nextIndexToEnd = pathLength

				if (indexToEnd === nextIndexToEnd && !child.isWildcardNode)
					continue

				// If the child is not a wildcard or parameter node
				// and the length of the child name is different from the length of the path
				if (
					!isChildWildcardOrParameterNode &&
					nextIndexToEnd - nextIndexToBegin !== child.name.length
				)
					continue

				// If the child has no children and the node is a wildcard or parameter node
				if (
					child.children.length === 0 &&
					isChildWildcardOrParameterNode
				)
					return child

				if (
					nextIndexToEnd >= pathLength - 1 &&
					child.method === method
				) {
					if (isChildWildcardOrParameterNode) return child

					const pathToCompute = path.substring(
						nextIndexToBegin,
						nextIndexToEnd,
					)

					if (pathToCompute === child.name) return child
				}

				const foundNode = isNodeMatch(
					child,
					nextIndexToBegin,
					nextIndexToEnd,
				)

				if (foundNode) return foundNode
			}

			return null
		}

		return isNodeMatch(this.root, 0, this.root.name.length)
	}

	// This function optimize the tree by merging all the nodes that only have one child
	optimizeTree() {
		const optimizeNode = (node: Node) => {
			// Merge multiple nodes that have only one child except parameter, wildcard and root nodes
			if (
				node.children.length === 1 &&
				!node.handler &&
				!node.isParameterNode &&
				!node.children[0].isParameterNode &&
				!node.isWildcardNode &&
				!node.children[0].isWildcardNode &&
				node.name !== '/'
			) {
				const child = node.children[0]

				node.name += child.name
				node.children = child.children
				node.handler = child.handler
				node.method = child.method

				optimizeNode(node)
			}

			node.children.forEach(optimizeNode)
		}

		optimizeNode(this.root)
	}
}