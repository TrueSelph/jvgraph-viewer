import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
	Box,
	Card,
	Text,
	JsonInput,
	Select,
	Flex,
	Title,
	Stack,
	Slider,
	InputWrapper,
	Button,
	Group,
	rem,
	SegmentedControl,
	Table,
	ActionIcon,
	Tooltip,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconLayoutSidebar, IconRefreshDot, IconX } from "@tabler/icons-react";

type NodeData = {
	id: string;
	label: string;
	group: string;
	info: Record<string, unknown>;
};

type EdgeData = {
	id: string;
	info: Record<string, unknown>;
	label: string;
	from: string;
	to: string;
};

export const Viewer = ({
	host,
	root_node,
}: {
	host: string;
	root_node: string;
}) => {
	const [hidePane, setHidePane] = useState(true);
	const graphRef = useRef<HTMLDivElement>(null);
	const [_selectedNodes, setSelectedNodes] = useState<string | null>(null);
	const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
	const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);
	const [network, setNetwork] = useState<Network | null>(null);
	const [nodes, _setNodes] = useState<DataSet<NodeData>>(new DataSet([]));
	const [edges, _setEdges] = useState<DataSet<EdgeData>>(new DataSet([]));
	const [rootId, setRootId] = useState<string>(root_node);
	const [lastNodeId, setLastNodeId] = useState<string>(root_node);
	const [traversalMode, setTraversalMode] = useState<"Full" | "Step" | "Focus">(
		"Step",
	);
	const [traversalDepth, setTraversalDepth] = useState<number>(1);
	const [objectView, setObjectView] = useState<"table" | "json">("table");
	const queryClient = useQueryClient();

	const { isSuccess, data } = useQuery<{
		nodes: {
			id: string;
			name: string;
			data: Record<string, unknown>;
		}[];
		edges: {
			id: string;
			data: Record<string, unknown>;
			name: string;
			source: string;
			target: string;
		}[];
	}>({
		queryKey: [`graph-${traversalMode}-${rootId}-${lastNodeId}`],
		queryFn: async () => {
			const token = localStorage.getItem("jivas-token");
			const headers = {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			};
			if (traversalMode === "Full") {
				return fetch(`${host}/walker/get_graph`, {
					body: JSON.stringify({ root_node: rootId }),
					headers,
					method: "POST",
				})
					.then((res) => res.json())
					.then((res) => res.reports[0]);
			}

			return fetch(`${host}/walker/get_node_connections`, {
				headers,
				body: JSON.stringify({ depth: traversalDepth, node_id: lastNodeId }),
				method: "POST",
			})
				.then((res) => res.json())
				.then((res) => res.reports[0]);
		},
		enabled: !!rootId,
	});

	useEffect(() => {
		if (!isSuccess) return;

		for (const node of data.nodes || []) {
			try {
				nodes.add({
					id: node.id,
					label: node.name,
					info: node.data,
					group: node.name,
				});
			} catch (e) {
				console.log(e);
			}
		}

		for (const edge of data.edges || []) {
			try {
				edges.add({
					id: edge.id,
					from: edge.source.split(":").pop() || "",
					info: edge.data,
					to: edge.target.split(":").pop() || "",
					label: edge.name,
				});
			} catch (e) {
				console.log(e);
			}
		}
	}, [data, isSuccess]);

	useEffect(() => {
		if (!graphRef.current) return;
		if (network) return;

		if (network !== null) {
			(network as Network)?.destroy();
			setNetwork(null);
		} else {
			setNetwork(
				new Network(
					graphRef.current,
					{
						nodes,
						edges,
					},
					{
						width: "100%",
						height: "100%",
						edges: {
							arrowStrikethrough: true,
							arrows: {
								to: {
									enabled: true,
									scaleFactor: 0.3,
								},
								from: {
									enabled: true,
									scaleFactor: 0.1,
									type: "circle",
								},
							},
						},
						nodes: {
							shape: "dot",
							size: 10,
							scaling: {
								customScalingFunction(_min, _max, total, value) {
									return value || 0 / (total || 0 * 2);
								},
								min: 8,
								max: 50,
							},
						},
						manipulation: {
							enabled: true,
							addNode: true,
						},
						// interaction: { hover: true },
						layout: {
							improvedLayout: false,
						},

						physics: {
							forceAtlas2Based: {
								springLength: 40,
							},
							solver: "forceAtlas2Based",
						},
					},
				),
			);
		}
	}, [graphRef.current]);

	useEffect(() => {
		if (!network) return;

		network.on("oncontext", (info) => {
			console.log({ info });
			info.event.preventDefault();
			const nodeId = network.getNodeAt(info.pointer.DOM);
			const edgeId = network.getEdgeAt(info.pointer.DOM);

			if (nodeId) {
				const node = nodes.get(nodeId) as unknown as NodeData;
				setHidePane(false);
				setSelectedNode(node);
				setSelectedEdge(null);
				network.selectNodes([nodeId]);
			} else if (!nodeId && edgeId) {
				const edge = edges.get(edgeId) as unknown as EdgeData;
				setHidePane(false);
				setSelectedNode(null);
				setSelectedEdge(edge);
				network.selectEdges([nodeId]);
			} else {
				setSelectedNode(null);
				setSelectedEdge(null);
			}
		});
		network.on("click", (info) => {
			setSelectedNodes(info.nodes);

			if (info.nodes.length === 1) {
				const node = nodes.get(info.nodes[0]) as unknown as NodeData;
				setSelectedEdge(null);
				setSelectedNode(node);
			} else if (info.nodes.length === 0 && info.edges.length === 1) {
				const edge = edges.get(info.edges[0]) as unknown as EdgeData;
				setSelectedNode(null);
				setSelectedEdge(edge);
			} else {
				setSelectedEdge(null);
				setSelectedNode(null);
			}
		});

		network.on("doubleClick", (info) => {
			const node = info.nodes[0];
			if (traversalMode === "Focus" && node) {
				nodes.remove(nodes.map((node) => node.id).filter((id) => id !== node));
			}

			if (node) {
				setLastNodeId(node);
			}

			if (!info.nodes.length && !info.edges.length) {
				setHidePane(true);
			}
		});
	}, [network, traversalMode]);

	return (
		<Box pos="relative">
			<Tooltip label="Open Sidebar">
				{hidePane && (
					<ActionIcon
						pos="absolute"
						onClick={() => setHidePane(false)}
						style={{ zIndex: 2 }}
						variant="default"
						color="gray"
						top={8}
						right={8}
					>
						<IconLayoutSidebar size={16} />
					</ActionIcon>
				)}
			</Tooltip>
			{/* {rootId} */}
			{/* <Box style={{ top: 8, left: 8, zIndex: 5 }} pos="absolute"> */}

			{/* </Box> */}
			<PanelGroup autoSaveId="jvgraph" direction="horizontal">
				<Panel defaultSize={75} id="graph">
					<div
						id="graph"
						style={{
							width: "100%",
							height: "100vh",
							backgroundImage: "radial-gradient(#e1e1e1 1px, #635c5c00 1px)",
							backgroundSize: "16px 16px",
							outline: "none",
						}}
						ref={graphRef}
					/>
				</Panel>
				<PanelResizeHandle />
				{!hidePane && (
					<Panel id="sidebar">
						<Card withBorder h="100%" w="100%">
							<Group justify="space-between" mb="xs">
								<Title order={5}>JIVAS Graph</Title>
								<ActionIcon
									onClick={() => setHidePane(true)}
									size="sm"
									variant="default"
								>
									<IconX size={16} />
								</ActionIcon>
							</Group>
							<Text c="gray.9" fw={500} fz="xs" tt="uppercase">
								Controls
							</Text>

							<Box w="100%" p="xs">
								<Stack gap="xs" mb="lg">
									<Select
										size="xs"
										label="Traversal Mode"
										searchable
										value={traversalMode}
										data={["Full", "Step", "Focus"]}
										onChange={(val) => {
											setLastNodeId(rootId);
											setRootId(rootId);
											edges.clear();
											nodes.clear();

											setTraversalMode(val as "Full" | "Step" | "Focus");
										}}
									/>

									<InputWrapper label="Depth" size="xs">
										<Slider
											size="xs"
											min={1}
											max={10}
											showLabelOnHover
											value={traversalDepth}
											onChange={(v) => setTraversalDepth(v)}
											marks={[
												{ value: 1, label: "1" },
												{ value: 5, label: "5" },
												{ value: 10, label: "10" },
											]}
										/>
									</InputWrapper>

									{(traversalMode === "Step" || traversalMode === "Focus") && (
										<Group justify="end">
											<Button
												onClick={() => {
													if (nodes.length === 1) return;
													edges.clear();
													nodes.clear();
													setLastNodeId(rootId);
													setRootId(rootId);
													setTimeout(() => {
														queryClient.refetchQueries();
														setTraversalDepth(1);
													}, 200);

													network?.fit();
												}}
												leftSection={
													<IconRefreshDot
														style={{ width: rem(18), height: rem(18) }}
													/>
												}
												mt="xl"
												size="compact-xs"
											>
												Reset Graph
											</Button>
										</Group>
									)}
								</Stack>
							</Box>

							<Flex justify={"space-between"} mb="xs" align="center">
								<Text c="gray.9" fw={500} fz="xs" tt="uppercase">
									Object Information
								</Text>

								<SegmentedControl
									data={[
										{ label: "JSON", value: "json" },
										{ label: "Table", value: "table" },
									]}
									defaultValue={objectView}
									size="xs"
									onChange={(value) => {
										setObjectView(value.toLowerCase() as typeof objectView);
									}}
								/>
							</Flex>

							{objectView === "table" && (
								<Table.ScrollContainer
									minWidth={500}
									maxHeight={500}
									scrollAreaProps={{
										offsetScrollbars: true,
										scrollbarSize: 1,
										overscrollBehavior: "auto",
									}}
								>
									<Table
										stickyHeader
										variant="vertical"
										layout="fixed"
										// withTableBorder
										withColumnBorders
										striped
									>
										<Table.Tbody>
											{selectedNode?.info &&
												Object.entries(selectedNode?.info || {})
													.sort((a, b) => a[0].localeCompare(b[0]))
													.map(([key, value]) => (
														<Table.Tr key={key}>
															<Table.Th
																w={160}
																style={{ position: "sticky", left: 0 }}
															>
																{key}
															</Table.Th>
															<Table.Td>
																{typeof value === "string" ||
																typeof value === "number"
																	? value
																	: JSON.stringify(value, null, 2)}
															</Table.Td>
														</Table.Tr>
													))}
											{selectedEdge?.info &&
												Object.entries(selectedEdge?.info || {}).map(
													([key, value]) => (
														<Table.Tr key={key}>
															<Table.Th w={160}>{key}</Table.Th>
															<Table.Td>
																{typeof value === "string" ||
																typeof value === "number"
																	? value
																	: JSON.stringify(value, null, 2)}
															</Table.Td>
														</Table.Tr>
													),
												)}
										</Table.Tbody>
									</Table>
								</Table.ScrollContainer>
							)}

							{objectView === "json" && (
								<JsonInput
									rows={20}
									minRows={7}
									value={JSON.stringify(
										selectedNode?.info || selectedEdge?.info,
										null,
										2,
									)}
									variant="filled"
								/>
							)}
						</Card>
					</Panel>
				)}
			</PanelGroup>
		</Box>
	);
};
