import { Box, MantineProvider } from "@mantine/core";
import { Viewer } from "./components/viewer";
import "@mantine/core/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export type AppProps = {
	host: string;
	root_node: string;
};

const queryClient = new QueryClient();

export function App(props: AppProps) {
	return (
		<MantineProvider>
			<QueryClientProvider client={queryClient}>
				<Box>
					<Viewer host={props.host} root_node={props.root_node} />
				</Box>
			</QueryClientProvider>
		</MantineProvider>
	);
}
