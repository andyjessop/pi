import { selectRouteName } from "pi";
import { useAppSelector } from "./hooks";
import { Layout } from "./components/Layout";
import { Container as HomeContainer } from "./modules/home";
import { Container as AboutContainer } from "./modules/about";
import { Container as ProductsContainer } from "./modules/products";
import { Container as ProductContainer } from "./modules/product";
import { Container as AdminContainer } from "./modules/admin";

function App() {
	// Use typed Redux selector - pure presentation layer
	const currentRoute = useAppSelector(selectRouteName);

	// Pure function: f(state) -> UI
	const renderPage = () => {
		switch (currentRoute) {
			case "home":
				return <HomeContainer />;
			case "about":
				return <AboutContainer />;
			case "products":
				return <ProductsContainer />;
			case "product":
				return <ProductContainer />;
			case "admin":
				return <AdminContainer />;
			default:
				return <HomeContainer />; // Default fallback
		}
	};

	return (
		<>
			<Layout currentRoute={currentRoute}>{renderPage()}</Layout>
		</>
	);
}

export default App;
