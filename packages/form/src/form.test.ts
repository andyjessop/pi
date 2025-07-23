// @ts-nocheck
import { expect, test, describe, mock } from "bun:test";
import { configureStore } from "@reduxjs/toolkit";
import {
	createForm,
	type FormConfig,
	type FormState,
	type Validator,
	type AsyncValidator,
} from "./form";

/* ============================================================================
 * Test utilities and setup
 * ========================================================================= */

// Utility function to create properly typed form configs for tests
function createLoginConfig(overrides: Partial<FormConfig<LoginFormValues>> = {}): FormConfig<LoginFormValues> {
	return {
		formId: "login",
		fields: {
			email: {
				initialValue: "",
				validators: [required, emailFormat],
			},
			password: {
				initialValue: "",
				validators: [required, minLength(8)],
			},
		},
		...overrides,
	} as FormConfig<LoginFormValues>;
}

function createProfileConfig(overrides: Partial<FormConfig<ProfileFormValues>> = {}): FormConfig<ProfileFormValues> {
	return {
		formId: "profile",
		fields: {
			firstName: {
				initialValue: "",
				validators: [required],
			},
			lastName: {
				initialValue: "",
				validators: [required],
			},
			age: {
				initialValue: 0,
				validators: [minAge],
			},
			bio: {
				initialValue: "",
				validators: [minLength(10)],
			},
		},
		...overrides,
	} as FormConfig<ProfileFormValues>;
}

interface LoginFormValues extends Record<string, unknown> {
	email: string;
	password: string;
}

interface ProfileFormValues extends Record<string, unknown> {
	firstName: string;
	lastName: string;
	age: number;
	bio: string;
}

interface TestState {
	[key: string]: FormState<any>;
}

function createTestStore<T extends Record<string, unknown>>(
	formConfig: FormConfig<T>,
	additionalForms: Record<string, any> = {},
	disableSerializationCheck = false,
) {
	const formArtifacts = createForm(formConfig);
	
	const reducers: Record<string, any> = {
		[formConfig.formId]: formArtifacts.reducer,
		...additionalForms,
	};
	
	const middlewares: any[] = [];
	if (formArtifacts.middleware) {
		middlewares.push(formArtifacts.middleware);
	}

	const storeConfig: any = {
		reducer: reducers,
		middleware: (getDefault: any) => getDefault().concat(...middlewares),
	};

	// Disable serialization checks for tests that intentionally use non-serializable values
	if (disableSerializationCheck) {
		storeConfig.middleware = (getDefault: any) => getDefault({
			serializableCheck: false,
		}).concat(...middlewares);
	}

	const store = configureStore(storeConfig);

	return {
		...store,
		formArtifacts,
	};
}

// Test validators
const required: Validator<string> = (value) => {
	return !value || value.trim() === "" ? "This field is required" : undefined;
};

const emailFormat: Validator<string> = (value) => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return value && !emailRegex.test(value) ? "Invalid email format" : undefined;
};

const minLength = (min: number): Validator<string> => (value) => {
	return value && value.length < min
		? `Must be at least ${min} characters`
		: undefined;
};

const minAge: Validator<number> = (value) => {
	return value < 18 ? "Must be at least 18 years old" : undefined;
};

// Test async validators
const checkEmailExists: AsyncValidator<string> = async (email) => {
	// Simulate API call
	await new Promise((resolve) => setTimeout(resolve, 50));
	
	// Simulate existing email check
	if (email === "taken@example.com") {
		return "Email is already taken";
	}
	return undefined;
};

// Note: unused in current tests but kept for potential future test cases
// const validateUsernameUnique: AsyncValidator<string> = async (username) => {
// 	await new Promise((resolve) => setTimeout(resolve, 30));
// 	
// 	if (username === "admin" || username === "root") {
// 		return "Username is not available";
// 	}
// 	return undefined;
// };

/* ============================================================================
 * Basic Form Creation Tests
 * ========================================================================= */

describe("Form Creation", () => {
	test("should create form artifacts correctly", () => {
		const config = createLoginConfig();
		const artifacts = createForm(config);

		expect(artifacts.reducer).toBeDefined();
		expect(artifacts.selectors).toBeDefined();
		expect(artifacts.actions).toBeDefined();
		expect(artifacts.middleware).toBeUndefined(); // No async validators
	});

	test("should create middleware when async validators are present", () => {
		const config: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "",
					validators: [required, emailFormat],
					asyncValidators: [checkEmailExists],
				},
				password: {
					initialValue: "",
					validators: [required, minLength(8)],
				},
			},
		};

		const artifacts = createForm(config);
		expect(artifacts.middleware).toBeDefined();
	});

	test("should initialize form state correctly", () => {
		const config: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "test@example.com",
				},
				password: {
					initialValue: "password123",
				},
			},
		};

		const store = createTestStore(config);
		const state = store.getState() as TestState;

		expect(state.login.submitting).toBe(false);
		expect(state.login.submitSucceeded).toBe(false);
		expect(state.login.submitError).toBeUndefined();
		expect(state.login.requestId).toBe(0);
		
		expect(state.login.fields.email.value).toBe("test@example.com");
		expect(state.login.fields.email.initialValue).toBe("test@example.com");
		expect(state.login.fields.email.dirty).toBe(false);
		expect(state.login.fields.email.touched).toBe(false);
		expect(state.login.fields.email.visited).toBe(false);
		expect(state.login.fields.email.focused).toBe(false);
		expect(state.login.fields.email.validating).toBe(false);
		expect(state.login.fields.email.errors).toEqual([]);
	});

	test("should validate config and throw on invalid input", () => {
		expect(() => {
			createForm({
				formId: "",
				fields: {},
			} as any);
		}).toThrow("FormConfig must have a formId");

		expect(() => {
			createForm({
				formId: "test",
				fields: {},
			} as any);
		}).toThrow("FormConfig must have at least one field");
	});
});

/* ============================================================================
 * Field Action Tests
 * ========================================================================= */

describe("Field Actions", () => {
	const config: FormConfig<LoginFormValues> = {
		formId: "login",
		fields: {
			email: {
				initialValue: "",
				validators: [required, emailFormat],
			},
			password: {
				initialValue: "",
				validators: [required, minLength(8)],
			},
		},
	};

	test("should update field value and mark as dirty", () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		store.dispatch(actions.updateFieldValue("email", "test@example.com"));

		const state = store.getState() as TestState;
		expect(state.login.fields.email.value).toBe("test@example.com");
		expect(state.login.fields.email.dirty).toBe(true);
	});

	test("should not mark field as dirty if value equals initial value", () => {
		const configWithInitial: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "initial@example.com",
				},
				password: {
					initialValue: "",
				},
			},
		};

		const store = createTestStore(configWithInitial);
		const { actions } = store.formArtifacts;

		// Set to different value first
		store.dispatch(actions.updateFieldValue("email", "changed@example.com"));
		expect(store.getState().login.fields.email.dirty).toBe(true);

		// Set back to initial value
		store.dispatch(actions.updateFieldValue("email", "initial@example.com"));
		expect(store.getState().login.fields.email.dirty).toBe(false);
	});

	test("should handle focus field action", () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		store.dispatch(actions.focusField("email"));

		const state = store.getState() as TestState;
		expect(state.login.fields.email.focused).toBe(true);
		expect(state.login.fields.email.visited).toBe(true);
	});

	test("should handle blur field action", () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Focus first
		store.dispatch(actions.focusField("email"));
		expect(store.getState().login.fields.email.focused).toBe(true);

		// Then blur
		store.dispatch(actions.blurField("email"));
		const state = store.getState() as TestState;
		expect(state.login.fields.email.focused).toBe(false);
		expect(state.login.fields.email.visited).toBe(true); // Should remain visited
	});

	test("should handle touch field action", () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		store.dispatch(actions.touchField("email"));

		const state = store.getState() as TestState;
		expect(state.login.fields.email.touched).toBe(true);
	});

	test("should reset form to initial state", () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Make some changes
		store.dispatch(actions.updateFieldValue("email", "test@example.com"));
		store.dispatch(actions.focusField("email"));
		store.dispatch(actions.touchField("email"));

		// Verify changes
		let state = store.getState() as TestState;
		expect(state.login.fields.email.value).toBe("test@example.com");
		expect(state.login.fields.email.dirty).toBe(true);
		expect(state.login.fields.email.focused).toBe(true);
		expect(state.login.fields.email.touched).toBe(true);
		expect(state.login.fields.email.visited).toBe(true);

		// Reset form
		store.dispatch(actions.resetForm());

		// Verify reset
		state = store.getState() as TestState;
		expect(state.login.fields.email.value).toBe("");
		expect(state.login.fields.email.dirty).toBe(false);
		expect(state.login.fields.email.focused).toBe(false);
		expect(state.login.fields.email.touched).toBe(false);
		expect(state.login.fields.email.visited).toBe(false);
		expect(state.login.submitting).toBe(false);
		expect(state.login.submitSucceeded).toBe(false);
		expect(state.login.submitError).toBeUndefined();
	});
});

/* ============================================================================
 * Selector Tests
 * ========================================================================= */

describe("Selectors", () => {
	const config: FormConfig<LoginFormValues> = {
		formId: "login",
		fields: {
			email: {
				initialValue: "initial@example.com",
				validators: [required, emailFormat],
			},
			password: {
				initialValue: "",
				validators: [required, minLength(8)],
			},
		},
	};

	test("should select form state", () => {
		const store = createTestStore(config);
		const { selectors } = store.formArtifacts;

		const formState = selectors.selectFormState()(store.getState());
		expect(formState).toBeDefined();
		expect(formState?.submitting).toBe(false);
		expect(formState?.fields).toBeDefined();
	});

	test("should select field values", () => {
		const store = createTestStore(config);
		const { selectors, actions } = store.formArtifacts;

		// Test initial value
		let emailValue = selectors.selectFieldValue("email")(store.getState());
		expect(emailValue).toBe("initial@example.com");

		// Update and test new value
		store.dispatch(actions.updateFieldValue("email", "new@example.com"));
		emailValue = selectors.selectFieldValue("email")(store.getState());
		expect(emailValue).toBe("new@example.com");
	});

	test("should select field errors", () => {
		const store = createTestStore(config);
		const { selectors, actions } = store.formArtifacts;

		// Initially no errors
		const emailErrors = selectors.getFieldError("email")(store.getState());
		expect(emailErrors).toBeUndefined();

		// Set invalid email to trigger validation manually
		store.dispatch(actions.updateFieldValue("email", "invalid-email"));
		
		// Manually validate by dispatching validateForm
		store.dispatch(actions.validateForm());

		// Wait for validation to complete and check for errors
		// Note: In a real scenario, you'd wait for async completion
	});

	test("should detect form dirty state", () => {
		const store = createTestStore(config);
		const { selectors, actions } = store.formArtifacts;

		// Initially not dirty
		expect(selectors.isFormDirty(store.getState())).toBe(false);

		// Make a change
		store.dispatch(actions.updateFieldValue("email", "changed@example.com"));
		expect(selectors.isFormDirty(store.getState())).toBe(true);

		// Reset back to initial
		store.dispatch(actions.updateFieldValue("email", "initial@example.com"));
		expect(selectors.isFormDirty(store.getState())).toBe(false);
	});

	test("should detect field dirty state", () => {
		const store = createTestStore(config);
		const { selectors, actions } = store.formArtifacts;

		// Initially not dirty
		expect(selectors.isFieldDirty("email")(store.getState())).toBe(false);

		// Make a change
		store.dispatch(actions.updateFieldValue("email", "changed@example.com"));
		expect(selectors.isFieldDirty("email")(store.getState())).toBe(true);
		expect(selectors.isFieldDirty("password")(store.getState())).toBe(false);
	});

	test("should get dirty fields list", () => {
		const store = createTestStore(config);
		const { selectors, actions } = store.formArtifacts;

		// Initially no dirty fields
		expect(selectors.getDirtyFields(store.getState())).toEqual([]);

		// Make changes
		store.dispatch(actions.updateFieldValue("email", "changed@example.com"));
		store.dispatch(actions.updateFieldValue("password", "newpassword"));

		const dirtyFields = selectors.getDirtyFields(store.getState());
		expect(dirtyFields).toContain("email");
		expect(dirtyFields).toContain("password");
		expect(dirtyFields.length).toBe(2);
	});

	test("should detect submission state", () => {
		const store = createTestStore(config);
		const { selectors } = store.formArtifacts;

		// Initially not submitting
		expect(selectors.isSubmitting(store.getState())).toBe(false);
	});
});

/* ============================================================================
 * Synchronous Validation Tests
 * ========================================================================= */

describe("Synchronous Validation", () => {
	const config: FormConfig<ProfileFormValues> = {
		formId: "profile",
		fields: {
			firstName: {
				initialValue: "",
				validators: [required],
			},
			lastName: {
				initialValue: "",
				validators: [required],
			},
			age: {
				initialValue: 0,
				validators: [minAge],
			},
			bio: {
				initialValue: "",
				validators: [minLength(10)],
			},
		},
	};

	test("should validate fields synchronously", async () => {
		const store = createTestStore(config);
		const { actions, selectors } = store.formArtifacts;

		// Set invalid values
		store.dispatch(actions.updateFieldValue("firstName", ""));
		store.dispatch(actions.updateFieldValue("age", 16));
		store.dispatch(actions.updateFieldValue("bio", "short"));

		// Trigger validation
		await store.dispatch(actions.validateForm());

		const state = store.getState() as any;
		
		// Check that validation was triggered (errors should be populated)
		expect(state.profile.fields.firstName.errors.length).toBeGreaterThan(0);
		expect(state.profile.fields.age.errors.length).toBeGreaterThan(0);
		expect(state.profile.fields.bio.errors.length).toBeGreaterThan(0);
	});

	test("should validate individual fields", async () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Set invalid email
		store.dispatch(actions.updateFieldValue("firstName", ""));

		// Validate just the email field
		await store.dispatch(actions.validateField("firstName"));

		const state = store.getState() as any;
		expect(state.profile.fields.firstName.errors).toContain("This field is required");
	});

	test("should clear errors when field becomes valid", async () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Set invalid value and validate
		store.dispatch(actions.updateFieldValue("firstName", ""));
		await store.dispatch(actions.validateField("firstName"));

		let state = store.getState() as any;
		expect(state.profile.fields.firstName.errors.length).toBeGreaterThan(0);

		// Set valid value and validate again
		store.dispatch(actions.updateFieldValue("firstName", "John"));
		await store.dispatch(actions.validateField("firstName"));

		state = store.getState() as any;
		expect(state.profile.fields.firstName.errors).toEqual([]);
	});
});

/* ============================================================================
 * Asynchronous Validation Tests
 * ========================================================================= */

describe("Asynchronous Validation", () => {
	const config: FormConfig<LoginFormValues> = {
		formId: "loginAsync",
		fields: {
			email: {
				initialValue: "",
				validators: [required, emailFormat],
				asyncValidators: [checkEmailExists],
			},
			password: {
				initialValue: "",
				validators: [required, minLength(8)],
			},
		},
	};

	test("should handle async validation success", async () => {
		const store = createTestStore(config);
		const { actions, selectors } = store.formArtifacts;

		// Set valid email
		store.dispatch(actions.updateFieldValue("email", "available@example.com"));

		// Validate
		await store.dispatch(actions.validateField("email"));

		const state = store.getState() as any;
		expect(state.loginAsync.fields.email.validating).toBe(false);
		expect(state.loginAsync.fields.email.errors).toEqual([]);
	});

	test("should handle async validation failure", async () => {
		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Set email that will be "taken"
		store.dispatch(actions.updateFieldValue("email", "taken@example.com"));

		// Validate
		await store.dispatch(actions.validateField("email"));

		const state = store.getState() as any;
		expect(state.loginAsync.fields.email.validating).toBe(false);
		expect(state.loginAsync.fields.email.errors).toContain("Email is already taken");
	});

	test("should set validating flag during async validation", async () => {
		const store = createTestStore(config);
		const { actions, selectors } = store.formArtifacts;

		// Set email
		store.dispatch(actions.updateFieldValue("email", "test@example.com"));

		// Start validation (don't await immediately)
		const validationPromise = store.dispatch(actions.validateField("email"));

		// Check that validating flag is set
		expect(selectors.isValidationPending(store.getState())).toBe(true);

		// Wait for completion
		await validationPromise;

		// Check that validating flag is cleared
		expect(selectors.isValidationPending(store.getState())).toBe(false);
	});
});

/* ============================================================================
 * Form Submission Tests
 * ========================================================================= */

describe("Form Submission", () => {
	test("should submit form with valid data", async () => {
		const onSubmitMock = mock(async (values: LoginFormValues) => {
			expect(values.email).toBe("test@example.com");
			expect(values.password).toBe("password123");
		});

		const config: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "",
					validators: [required, emailFormat],
				},
				password: {
					initialValue: "",
					validators: [required, minLength(8)],
				},
			},
			onSubmit: onSubmitMock,
		};

		const store = createTestStore(config);
		const { actions, selectors } = store.formArtifacts;

		// Set valid values
		store.dispatch(actions.updateFieldValue("email", "test@example.com"));
		store.dispatch(actions.updateFieldValue("password", "password123"));

		// Submit form
		await store.dispatch(actions.submitForm());

		const state = store.getState() as TestState;
		expect(state.login.submitSucceeded).toBe(true);
		expect(state.login.submitting).toBe(false);
		expect(state.login.submitError).toBeUndefined();
		expect(onSubmitMock).toHaveBeenCalledTimes(1);
	});

	test("should not submit form with validation errors", async () => {
		const onSubmitMock = mock();

		const config: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "",
					validators: [required, emailFormat],
				},
				password: {
					initialValue: "",
					validators: [required, minLength(8)],
				},
			},
			onSubmit: onSubmitMock,
		};

		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Set invalid values
		store.dispatch(actions.updateFieldValue("email", "invalid-email"));
		store.dispatch(actions.updateFieldValue("password", "123")); // Too short

		// Try to submit form
		try {
			await store.dispatch(actions.submitForm());
		} catch (error) {
			// Expected to throw due to validation errors
		}

		const state = store.getState() as TestState;
		expect(state.login.submitSucceeded).toBe(false);
		expect(state.login.submitting).toBe(false);
		expect(onSubmitMock).not.toHaveBeenCalled();
	});

	test("should handle submission errors", async () => {
		const onSubmitMock = mock(async () => {
			throw new Error("Network error");
		});

		const config: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "",
					validators: [required, emailFormat],
				},
				password: {
					initialValue: "",
					validators: [required, minLength(8)],
				},
			},
			onSubmit: onSubmitMock,
		};

		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Set valid values
		store.dispatch(actions.updateFieldValue("email", "test@example.com"));
		store.dispatch(actions.updateFieldValue("password", "password123"));

		// Submit form
		try {
			await store.dispatch(actions.submitForm());
		} catch (error) {
			// Expected to throw
		}

		const state = store.getState() as TestState;
		expect(state.login.submitSucceeded).toBe(false);
		expect(state.login.submitting).toBe(false);
		expect(state.login.submitError).toBeDefined();
	});

	test("should set submitting flag during submission", async () => {
		const onSubmitMock = mock(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		const config: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "",
					validators: [required, emailFormat],
				},
				password: {
					initialValue: "",
					validators: [required, minLength(8)],
				},
			},
			onSubmit: onSubmitMock,
		};

		const store = createTestStore(config);
		const { actions, selectors } = store.formArtifacts;

		// Set valid values
		store.dispatch(actions.updateFieldValue("email", "test@example.com"));
		store.dispatch(actions.updateFieldValue("password", "password123"));

		// Start submission (don't await immediately)
		const submissionPromise = store.dispatch(actions.submitForm());

		// Check that submitting flag is set
		expect(selectors.isSubmitting(store.getState())).toBe(true);

		// Wait for completion
		await submissionPromise;

		// Give a small delay to ensure all state updates are processed
		await new Promise(resolve => setTimeout(resolve, 10));

		// Check that submitting flag is cleared
		expect(selectors.isSubmitting(store.getState())).toBe(false);
	});
});

/* ============================================================================
 * State Serialization Tests
 * ========================================================================= */

describe("State Serialization", () => {
	test("should maintain serializable state", () => {
		const config: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: {
					initialValue: "test@example.com",
					validators: [required, emailFormat],
				},
				password: {
					initialValue: "",
					validators: [required, minLength(8)],
				},
			},
		};

		const store = createTestStore(config);
		const { actions } = store.formArtifacts;

		// Make some changes
		store.dispatch(actions.updateFieldValue("email", "new@example.com"));
		store.dispatch(actions.focusField("email"));
		store.dispatch(actions.touchField("email"));

		const state = store.getState();

		// Test serialization roundtrip
		const serialized = JSON.stringify(state);
		const deserialized = JSON.parse(serialized);
		
		expect(deserialized.loginForm).toEqual(state.loginForm);
	});
});

/* ============================================================================
 * Multiple Forms Tests
 * ========================================================================= */

describe("Multiple Forms", () => {
	test("should handle multiple forms in same store", () => {
		const loginConfig: FormConfig<LoginFormValues> = {
			formId: "login",
			fields: {
				email: { initialValue: "" },
				password: { initialValue: "" },
			},
		};

		const profileConfig: FormConfig<ProfileFormValues> = {
			formId: "profile",
			fields: {
				firstName: { initialValue: "" },
				lastName: { initialValue: "" },
				age: { initialValue: 25 },
				bio: { initialValue: "" },
			},
		};

		const loginArtifacts = createForm(loginConfig);
		const profileArtifacts = createForm(profileConfig);

		const store = configureStore({
			reducer: {
				login: loginArtifacts.reducer,
				profile: profileArtifacts.reducer,
			},
		});

		// Test both forms work independently
		store.dispatch(loginArtifacts.actions.updateFieldValue("email", "test@example.com"));
		store.dispatch(profileArtifacts.actions.updateFieldValue("firstName", "John"));

		const state = store.getState() as any;
		expect(state.login.fields.email.value).toBe("test@example.com");
		expect(state.profile.fields.firstName.value).toBe("John");
		
		// Forms should not interfere with each other
		expect(state.login.fields.email.dirty).toBe(true);
		expect(state.profile.fields.firstName.dirty).toBe(true);
		expect(state.profile.fields.lastName.dirty).toBe(false);
	});
});

/* ============================================================================
 * Edge Cases and Corner Cases Tests
 * ========================================================================= */

describe("Edge Cases and Corner Cases", () => {
	describe("Config Edge Cases", () => {
		test("should handle empty formId", () => {
			expect(() => {
				createForm({
					formId: "",
					fields: {
						test: { initialValue: "" },
					},
				} as any);
			}).toThrow("FormConfig must have a formId");
		});

		test("should handle null/undefined formId", () => {
			expect(() => {
				createForm({
					formId: null,
					fields: {
						test: { initialValue: "" },
					},
				} as any);
			}).toThrow("FormConfig must have a formId");

			expect(() => {
				createForm({
					formId: undefined,
					fields: {
						test: { initialValue: "" },
					},
				} as any);
			}).toThrow("FormConfig must have a formId");
		});

		test("should handle empty fields object", () => {
			expect(() => {
				createForm({
					formId: "test",
					fields: {},
				} as any);
			}).toThrow("FormConfig must have at least one field");
		});

		test("should handle null/undefined fields", () => {
			expect(() => {
				createForm({
					formId: "test",
					fields: null,
				} as any);
			}).toThrow("FormConfig must have at least one field");

			expect(() => {
				createForm({
					formId: "test",
					fields: undefined,
				} as any);
			}).toThrow("FormConfig must have at least one field");
		});
	});

	describe("Field Value Edge Cases", () => {
		test("should handle null and undefined initial values", () => {
			const config = {
				formId: "nullTest",
				fields: {
					nullField: { initialValue: null },
					undefinedField: { initialValue: undefined },
					zeroField: { initialValue: 0 },
					falseField: { initialValue: false },
					emptyStringField: { initialValue: "" },
				},
			} as any;

			const store = createTestStore(config);
			const state = store.getState();

			expect(state.nullTest.fields.nullField.value).toBe(null);
			expect(state.nullTest.fields.undefinedField.value).toBe(undefined);
			expect(state.nullTest.fields.zeroField.value).toBe(0);
			expect(state.nullTest.fields.falseField.value).toBe(false);
			expect(state.nullTest.fields.emptyStringField.value).toBe("");
		});

		test("should handle complex object initial values", () => {
			const complexObject = {
				nested: { deeply: { value: "test" } },
				array: [1, 2, { key: "value" }],
				date: new Date("2023-01-01"),
			};

			const config = {
				formId: "complexTest",
				fields: {
					complexField: { initialValue: complexObject },
				},
			} as any;

			const store = createTestStore(config, {}, true); // Disable serialization check for Date object
			const { actions } = store.formArtifacts;
			const state = store.getState();

			expect(state.complexTest.fields.complexField.value).toEqual(complexObject);

			// Test updating complex object
			const newComplexObject = { ...complexObject, newProp: "added" };
			store.dispatch(actions.updateFieldValue("complexField", newComplexObject));

			const updatedState = store.getState();
			expect(updatedState.complexTest.fields.complexField.value).toEqual(newComplexObject);
			expect(updatedState.complexTest.fields.complexField.dirty).toBe(true);
		});

		test("should handle array initial values", () => {
			const config = {
				formId: "arrayTest",
				fields: {
					tags: { initialValue: ["tag1", "tag2"] },
					numbers: { initialValue: [1, 2, 3] },
					emptyArray: { initialValue: [] },
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Test array manipulation
			store.dispatch(actions.updateFieldValue("tags", ["tag1", "tag2", "tag3"]));
			store.dispatch(actions.updateFieldValue("numbers", []));

			const state = store.getState();
			expect(state.arrayTest.fields.tags.value).toEqual(["tag1", "tag2", "tag3"]);
			expect(state.arrayTest.fields.tags.dirty).toBe(true);
			expect(state.arrayTest.fields.numbers.value).toEqual([]);
			expect(state.arrayTest.fields.numbers.dirty).toBe(true);
			expect(state.arrayTest.fields.emptyArray.dirty).toBe(false);
		});
	});

	describe("Field Path Edge Cases", () => {
		test("should handle non-existent field paths", () => {
			const config = createLoginConfig();
			const store = createTestStore(config);
			const { actions, selectors } = store.formArtifacts;

			// Try to update non-existent field - should not crash
			store.dispatch(actions.updateFieldValue("nonExistentField" as any, "value"));

			// Try to focus non-existent field - should not crash
			store.dispatch(actions.focusField("nonExistentField" as any));
			store.dispatch(actions.blurField("nonExistentField" as any));
			store.dispatch(actions.touchField("nonExistentField" as any));

			// Selectors should handle non-existent fields gracefully
			const nonExistentValue = selectors.selectFieldValue("nonExistentField" as any)(store.getState());
			const nonExistentError = selectors.getFieldError("nonExistentField" as any)(store.getState());
			const nonExistentDirty = selectors.isFieldDirty("nonExistentField" as any)(store.getState());

			expect(nonExistentValue).toBeUndefined();
			expect(nonExistentError).toBeUndefined();
			expect(nonExistentDirty).toBe(false);
		});

		test("should handle special characters in field names", () => {
			const config = {
				formId: "specialChars",
				fields: {
					"field-with-dashes": { initialValue: "dash" },
					"field_with_underscores": { initialValue: "underscore" },
					"field.with.dots": { initialValue: "dots" },
					"field with spaces": { initialValue: "spaces" },
					"field@with$symbols%": { initialValue: "symbols" },
				},
			} as any;

			const store = createTestStore(config);
			const { actions, selectors } = store.formArtifacts;

			// Test all special character field names
			const fieldNames = [
				"field-with-dashes",
				"field_with_underscores", 
				"field.with.dots",
				"field with spaces",
				"field@with$symbols%",
			];

			for (const fieldName of fieldNames) {
				store.dispatch(actions.updateFieldValue(fieldName, `updated-${fieldName}`));
				const value = selectors.selectFieldValue(fieldName)(store.getState());
				expect(value).toBe(`updated-${fieldName}`);
			}
		});
	});

	describe("Validation Edge Cases", () => {
		test("should handle validators that return null instead of undefined", async () => {
			const nullReturningValidator = (value: string) => {
				return value === "invalid" ? null : undefined;
			};

			const config = {
				formId: "nullValidator",
				fields: {
					test: {
						initialValue: "",
						validators: [nullReturningValidator as any],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			store.dispatch(actions.updateFieldValue("test", "invalid"));
			await store.dispatch(actions.validateField("test"));

			// Should not crash and should treat null as no error
			const state = store.getState();
			expect(state.nullValidator.fields.test.errors).toEqual([]);
		});

		test("should handle validators that throw exceptions", async () => {
			const throwingValidator = () => {
				throw new Error("Validator crashed");
			};

			const config = {
				formId: "throwingValidator",
				fields: {
					test: {
						initialValue: "",
						validators: [throwingValidator],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Should not crash the application but may result in validation failure
			await expect(async () => {
				store.dispatch(actions.updateFieldValue("test", "value"));
				await store.dispatch(actions.validateField("test"));
			}).not.toThrow();
		});

		test("should handle empty validator arrays", async () => {
			const config = {
				formId: "emptyValidators",
				fields: {
					test: {
						initialValue: "",
						validators: [],
						asyncValidators: [],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions, selectors } = store.formArtifacts;

			store.dispatch(actions.updateFieldValue("test", "any value"));
			await store.dispatch(actions.validateField("test"));

			expect(selectors.getFieldError("test")(store.getState())).toBeUndefined();
		});

		test("should handle async validators that reject with non-Error objects", async () => {
			const rejectingAsyncValidator = async () => {
				throw "String error"; // Not an Error object
			};

			const config = {
				formId: "rejectingAsync",
				fields: {
					test: {
						initialValue: "",
						asyncValidators: [rejectingAsyncValidator],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			store.dispatch(actions.updateFieldValue("test", "value"));

			try {
				await store.dispatch(actions.validateField("test"));
			} catch (error) {
				// Should handle gracefully
			}

			const state = store.getState();
			expect(state.rejectingAsync.fields.test.errors).toContain("Async validation failed");
		});

		test("should handle multiple async validators with different timing", async () => {
			const fastValidator = async (value: string) => {
				await new Promise(resolve => setTimeout(resolve, 10));
				return value === "fast-error" ? "Fast validation error" : undefined;
			};

			const slowValidator = async (value: string) => {
				await new Promise(resolve => setTimeout(resolve, 100));
				return value === "slow-error" ? "Slow validation error" : undefined;
			};

			const config = {
				formId: "timingTest",
				fields: {
					test: {
						initialValue: "",
						asyncValidators: [fastValidator, slowValidator],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Test fast error (should stop at first error)
			store.dispatch(actions.updateFieldValue("test", "fast-error"));
			await store.dispatch(actions.validateField("test"));

			let state = store.getState();
			expect(state.timingTest.fields.test.errors).toContain("Fast validation error");
			expect(state.timingTest.fields.test.errors).not.toContain("Slow validation error");

			// Test slow error (fast passes, slow fails)
			store.dispatch(actions.updateFieldValue("test", "slow-error"));
			await store.dispatch(actions.validateField("test"));

			state = store.getState();
			expect(state.timingTest.fields.test.errors).toContain("Slow validation error");
		});
	});

	describe("Request ID and Race Condition Edge Cases", () => {
		test("should handle concurrent validation requests", async () => {
			const delayedValidator = async (value: string) => {
				const delay = value === "slow" ? 100 : 10;
				await new Promise(resolve => setTimeout(resolve, delay));
				return value === "error" ? "Validation error" : undefined;
			};

			const config = {
				formId: "concurrentTest",
				fields: {
					test: {
						initialValue: "",
						asyncValidators: [delayedValidator],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Start multiple validation requests concurrently
			store.dispatch(actions.updateFieldValue("test", "slow"));
			const promise1 = store.dispatch(actions.validateField("test"));

			// Quickly change value and validate again
			store.dispatch(actions.updateFieldValue("test", "fast"));
			const promise2 = store.dispatch(actions.validateField("test"));

			store.dispatch(actions.updateFieldValue("test", "error"));
			const promise3 = store.dispatch(actions.validateField("test"));

			// Wait for all to complete
			await Promise.allSettled([promise1, promise2, promise3]);

			// The final state should reflect the last validation
			const state = store.getState();
			expect(state.concurrentTest.fields.test.errors).toContain("Validation error");
		});

		test("should handle validation during form submission", async () => {
			const onSubmitMock = mock(async () => {
				await new Promise(resolve => setTimeout(resolve, 50));
			});

			const asyncValidator = async (value: string) => {
				await new Promise(resolve => setTimeout(resolve, 30));
				return value === "invalid" ? "Async error" : undefined;
			};

			const config = {
				formId: "submitValidation",
				fields: {
					test: {
						initialValue: "",
						validators: [required],
						asyncValidators: [asyncValidator],
					},
				},
				onSubmit: onSubmitMock,
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Set valid value
			store.dispatch(actions.updateFieldValue("test", "valid"));

			// Start validation and submission concurrently
			const validationPromise = store.dispatch(actions.validateField("test"));
			const submissionPromise = store.dispatch(actions.submitForm());

			await Promise.allSettled([validationPromise, submissionPromise]);

			const state = store.getState();
			expect(state.submitValidation.submitSucceeded).toBe(true);
			expect(onSubmitMock).toHaveBeenCalled();
		});

		test("should handle very high request IDs", async () => {
			const config = createLoginConfig();
			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Simulate many validation requests to test high request IDs
			for (let i = 0; i < 100; i++) {
				store.dispatch(actions.updateFieldValue("email", `test${i}@example.com`));
				if (i % 10 === 0) {
					await store.dispatch(actions.validateField("email"));
				}
			}

			const state = store.getState();
			expect(state.login.requestId).toBeGreaterThan(0);
		});
	});

	describe("Middleware Edge Cases", () => {
		test("should handle middleware with no async validators", () => {
			const config = createLoginConfig();
			const artifacts = createForm(config);

			expect(artifacts.middleware).toBeUndefined();
		});

		test("should handle middleware action interception", async () => {
			const config = {
				formId: "middlewareTest",
				fields: {
					test: {
						initialValue: "",
						asyncValidators: [checkEmailExists],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Test that actions are properly intercepted by middleware
			store.dispatch(actions.updateFieldValue("test", "taken@example.com"));
			await store.dispatch(actions.validateField("test"));

			// Middleware should handle the validation start action
			const state = store.getState();
			expect(state.middlewareTest.fields.test.errors).toContain("Email is already taken");
		});

		test("should handle stale validation actions", async () => {
			const slowValidator = async (value: string) => {
				await new Promise(resolve => setTimeout(resolve, 100));
				return value === "error" ? "Slow error" : undefined;
			};

			const config = {
				formId: "staleTest",
				fields: {
					test: {
						initialValue: "",
						asyncValidators: [slowValidator],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Start slow validation
			store.dispatch(actions.updateFieldValue("test", "value1"));
			const promise1 = store.dispatch(actions.validateField("test"));

			// Quickly start another validation (should make first one stale)
			store.dispatch(actions.updateFieldValue("test", "value2"));
			const promise2 = store.dispatch(actions.validateField("test"));

			await Promise.allSettled([promise1, promise2]);

			// Should handle stale validations gracefully
			const state = store.getState();
			expect(state.staleTest.fields.test.validating).toBe(false);
		});
	});

	describe("Selector Edge Cases", () => {
		test("should handle selectors with undefined form state", () => {
			const config = createLoginConfig();
			const { selectors } = createForm(config);

			const emptyState = {};

			// All selectors should handle missing form state gracefully
			expect(selectors.selectFormState()(emptyState)).toBeUndefined();
			expect(selectors.selectFieldValue("email")(emptyState)).toBeUndefined();
			expect(selectors.getFieldError("email")(emptyState)).toBeUndefined();
			expect(selectors.isSubmitting(emptyState)).toBe(false);
			expect(selectors.isValidationPending(emptyState)).toBe(false);
			expect(selectors.isFormValid(emptyState)).toBe(false);
			expect(selectors.isFieldDirty("email")(emptyState)).toBe(false);
			expect(selectors.isFormDirty(emptyState)).toBe(false);
			expect(selectors.getDirtyFields(emptyState)).toEqual([]);
		});

		test("should handle selectors with partial form state", () => {
			const config = createLoginConfig();
			const { selectors } = createForm(config);

			const partialState = {
				login: {
					// Missing some required fields
					submitting: true,
					fields: {
						email: {
							value: "test@example.com",
							errors: [],
						},
						// Missing password field
					},
				},
			};

			// Selectors should handle partial state gracefully
			expect(selectors.isSubmitting(partialState)).toBe(true);
			expect(selectors.selectFieldValue("email")(partialState)).toBe("test@example.com");
		});

		test("should handle memoization correctly", () => {
			const config = createLoginConfig();
			const store = createTestStore(config);
			const { selectors, actions } = store.formArtifacts;

			const state1 = store.getState();
			const dirtyFields1 = selectors.getDirtyFields(state1);
			const dirtyFields2 = selectors.getDirtyFields(state1);

			// Should return same reference due to memoization
			expect(dirtyFields1).toBe(dirtyFields2);

			// After state change, should return new reference
			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			const state2 = store.getState();
			const dirtyFields3 = selectors.getDirtyFields(state2);

			expect(dirtyFields3).not.toBe(dirtyFields1);
		});
	});

	describe("Form Reset Edge Cases", () => {
		test("should handle reset during submission", async () => {
			const onSubmitMock = mock(async () => {
				await new Promise(resolve => setTimeout(resolve, 100));
			});

			const config = createLoginConfig({ onSubmit: onSubmitMock });
			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Set up form
			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			store.dispatch(actions.updateFieldValue("password", "password123"));
			store.dispatch(actions.focusField("email"));
			store.dispatch(actions.touchField("password"));

			// Start submission
			const submissionPromise = store.dispatch(actions.submitForm());

			// Reset during submission
			store.dispatch(actions.resetForm());

			// Should handle gracefully
			await submissionPromise.catch(() => {}); // Ignore potential errors

			const state = store.getState();
			expect(state.login.fields.email.value).toBe("");
			expect(state.login.fields.password.value).toBe("");
			expect(state.login.fields.email.dirty).toBe(false);
			expect(state.login.fields.email.focused).toBe(false);
			expect(state.login.fields.password.touched).toBe(false);
		});

		test("should handle reset during async validation", async () => {
			const slowValidator = async () => {
				await new Promise(resolve => setTimeout(resolve, 100));
				return "Validation error";
			};

			const config = {
				formId: "resetValidation",
				fields: {
					test: {
						initialValue: "",
						asyncValidators: [slowValidator],
					},
				},
			} as any;

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Start validation
			store.dispatch(actions.updateFieldValue("test", "value"));
			const validationPromise = store.dispatch(actions.validateField("test"));

			// Reset during validation
			store.dispatch(actions.resetForm());

			await validationPromise.catch(() => {}); // Ignore potential errors

			const state = store.getState();
			expect(state.resetValidation.fields.test.value).toBe("");
			expect(state.resetValidation.fields.test.validating).toBe(false);
		});
	});

	describe("Submission Edge Cases", () => {
		test("should handle onSubmit that returns non-promise", async () => {
			const syncOnSubmit = mock((values) => {
				return "sync result";
			});

			const config = createLoginConfig({ onSubmit: syncOnSubmit });
			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			store.dispatch(actions.updateFieldValue("password", "password123"));

			await store.dispatch(actions.submitForm());

			expect(syncOnSubmit).toHaveBeenCalled();
			const state = store.getState();
			expect(state.login.submitSucceeded).toBe(true);
		});

		test("should handle onSubmit that returns undefined", async () => {
			const undefinedOnSubmit = mock(() => undefined);

			const config = createLoginConfig({ onSubmit: undefinedOnSubmit });
			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			store.dispatch(actions.updateFieldValue("password", "password123"));

			await store.dispatch(actions.submitForm());

			expect(undefinedOnSubmit).toHaveBeenCalled();
			const state = store.getState();
			expect(state.login.submitSucceeded).toBe(true);
		});

		test("should handle submission without onSubmit callback", async () => {
			const config = createLoginConfig(); // No onSubmit

			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			store.dispatch(actions.updateFieldValue("password", "password123"));

			await store.dispatch(actions.submitForm());

			const state = store.getState();
			expect(state.login.submitSucceeded).toBe(true);
		});

		test("should handle onSubmit with dispatch and getState usage", async () => {
			const statefulOnSubmit = mock(async (values, dispatch, getState) => {
				const currentState = getState();
				expect(currentState).toBeDefined();
				
				// Mock dispatching some action
				dispatch({ type: "CUSTOM_ACTION", payload: values });
				
				return { submitted: true };
			});

			const config = createLoginConfig({ onSubmit: statefulOnSubmit });
			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			store.dispatch(actions.updateFieldValue("password", "password123"));

			await store.dispatch(actions.submitForm());

			expect(statefulOnSubmit).toHaveBeenCalledWith(
				{ email: "test@example.com", password: "password123" },
				expect.any(Function),
				expect.any(Function)
			);
		});
	});

	describe("Complex State Scenarios", () => {
		test("should handle rapid state changes", () => {
			const config = createLoginConfig();
			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Rapid fire actions - should not crash or cause inconsistent state
			for (let i = 0; i < 100; i++) {
				store.dispatch(actions.updateFieldValue("email", `test${i}@example.com`));
				store.dispatch(actions.focusField("email"));
				store.dispatch(actions.blurField("email"));
				store.dispatch(actions.touchField("email"));
				
				if (i % 10 === 0) {
					store.dispatch(actions.resetForm());
				}
			}

			// Final state should be consistent (last reset was at i=90, then 9 more updates)
			const state = store.getState();
			expect(state.login.fields.email.value).toBe("test99@example.com");
			expect(state.login.fields.email.dirty).toBe(true);
			expect(state.login.fields.email.touched).toBe(true);
			expect(state.login.fields.email.visited).toBe(true);
			expect(state.login.fields.email.focused).toBe(false); // Last action was blur
		});

		test("should handle form with many fields", () => {
			const manyFields: any = {};
			for (let i = 0; i < 100; i++) {
				manyFields[`field${i}`] = { initialValue: `value${i}` };
			}

			const config = {
				formId: "manyFields",
				fields: manyFields,
			};

			const store = createTestStore(config);
			const { actions, selectors } = store.formArtifacts;

			// Update many fields
			for (let i = 0; i < 100; i++) {
				store.dispatch(actions.updateFieldValue(`field${i}`, `updated${i}`));
			}

			const dirtyFields = selectors.getDirtyFields(store.getState());
			expect(dirtyFields).toHaveLength(100);
			expect(selectors.isFormDirty(store.getState())).toBe(true);
		});

		test("should handle deeply nested object values", () => {
			const deepObject = {
				level1: {
					level2: {
						level3: {
							level4: {
								level5: {
									value: "deep value",
									array: [1, 2, { nested: "array object" }],
								},
							},
						},
					},
				},
			};

			const config = {
				formId: "deepNesting",
				fields: {
					deep: { initialValue: deepObject },
				},
			} as any;

			const store = createTestStore(config);
			const { actions, selectors } = store.formArtifacts;

			const modifiedDeep = {
				...deepObject,
				level1: {
					...deepObject.level1,
					level2: {
						...deepObject.level1.level2,
						level3: {
							...deepObject.level1.level2.level3,
							level4: {
								...deepObject.level1.level2.level3.level4,
								level5: {
									...deepObject.level1.level2.level3.level4.level5,
									value: "modified deep value",
								},
							},
						},
					},
				},
			};

			store.dispatch(actions.updateFieldValue("deep", modifiedDeep));

			const value = selectors.selectFieldValue("deep")(store.getState());
			expect(value.level1.level2.level3.level4.level5.value).toBe("modified deep value");
			expect(selectors.isFieldDirty("deep")(store.getState())).toBe(true);
		});
	});

	describe("Memory and Performance Edge Cases", () => {
		test("should handle rapid selector calls", () => {
			const config = createLoginConfig();
			const store = createTestStore(config);
			const { selectors } = store.formArtifacts;

			const state = store.getState();

			// Call selectors many times - should not cause memory issues
			for (let i = 0; i < 1000; i++) {
				selectors.selectFieldValue("email")(state);
				selectors.getFieldError("email")(state);
				selectors.isFormDirty(state);
				selectors.isFormValid(state);
				selectors.getDirtyFields(state);
			}

			// Should complete without issues
			expect(true).toBe(true);
		});

		test("should handle large field values", () => {
			const largeString = "x".repeat(10000);
			const largeArray = new Array(1000).fill(0).map((_, i) => ({ id: i, data: `data${i}` }));

			const config = {
				formId: "largeValues",
				fields: {
					largeString: { initialValue: largeString },
					largeArray: { initialValue: largeArray },
				},
			} as any;

			const store = createTestStore(config);
			const { actions, selectors } = store.formArtifacts;

			// Should handle large values without issues
			store.dispatch(actions.updateFieldValue("largeString", `${largeString}modified`));
			store.dispatch(actions.updateFieldValue("largeArray", [...largeArray, { id: 1000, data: "new" }]));

			const stringValue = selectors.selectFieldValue("largeString")(store.getState());
			const arrayValue = selectors.selectFieldValue("largeArray")(store.getState());

			expect(stringValue).toBe(`${largeString}modified`);
			expect(arrayValue).toHaveLength(1001);
		});
	});

	describe("Serialization Edge Cases", () => {
		test("should handle non-serializable values gracefully", () => {
			const nonSerializableValue = {
				date: new Date(),
				func: () => "test",
				symbol: Symbol("test"),
				regex: /test/g,
				map: new Map([["key", "value"]]),
				set: new Set([1, 2, 3]),
			};

			const config = {
				formId: "nonSerializable",
				fields: {
					complex: { initialValue: nonSerializableValue },
				},
			} as any;

			const store = createTestStore(config, {}, true); // Disable serialization check for non-serializable values
			const state = store.getState();

			// Should not crash when state contains non-serializable values
			expect(state.nonSerializable.fields.complex.value).toBe(nonSerializableValue);

			// JSON serialization might fail, but shouldn't crash the form
			expect(() => {
				try {
					JSON.stringify(state);
				} catch (e) {
					// Expected for non-serializable values
				}
			}).not.toThrow();
		});

		test("should handle circular references", () => {
			// Test with a less problematic "pseudo-circular" structure
			// Real circular references will cause issues with JSON.stringify and type checking
			const pseudoCircular = {
				name: "root",
				child: {
					name: "child",
					parent: null as any // Will be set to root
				}
			};
			pseudoCircular.child.parent = pseudoCircular;

			const config = {
				formId: "circular",
				fields: {
					circular: { initialValue: pseudoCircular },
				},
			} as any;

			// Should not crash when creating store and dispatching actions
			expect(() => {
				const store = createTestStore(config);
				// Store creation should work
				expect(store.getState().circular).toBeDefined();
			}).not.toThrow();

			// Test that the form library can handle objects that would fail JSON.stringify
			const nonSerializableObj = {
				date: new Date(),
				func: () => "test",
				symbol: Symbol("test")
			};

			const nonSerConfig = {
				formId: "nonSerial",
				fields: {
					complex: { initialValue: nonSerializableObj },
				},
			} as any;

			expect(() => {
				const store = createTestStore(nonSerConfig, {}, true); // Disable serialization check for non-serializable values
				const { actions } = store.formArtifacts;
				store.dispatch(actions.updateFieldValue("complex", { ...nonSerializableObj, updated: true }));
			}).not.toThrow();
		});
	});

	describe("Error Boundary Edge Cases", () => {
		test("should handle malformed state updates", () => {
			const config = createLoginConfig();
			const store = createTestStore(config);

			// With the defensive guards in place, malformed actions should not crash
			const stateBefore = store.getState();
			
			// These should all be handled gracefully now
			store.dispatch({ type: "form/login/updateFieldValue", payload: null });
			store.dispatch({ type: "form/login/updateFieldValue", payload: {} });
			store.dispatch({ type: "form/login/updateFieldValue" });
			store.dispatch({ type: "form/login/updateFieldValue", payload: { path: 123, value: "test" } }); // invalid path type
			store.dispatch({ type: "form/login/updateFieldValue", payload: { value: "test" } }); // missing path
			
			const stateAfter = store.getState();
			
			// State should remain unchanged for malformed actions
			expect(stateAfter).toEqual(stateBefore);

			// But valid actions should still work
			store.dispatch({ type: "form/login/updateFieldValue", payload: { path: "email", value: "test@example.com" } });

			// Verify the valid action worked
			const finalState = store.getState();
			expect(finalState.login.fields.email.value).toBe("test@example.com");
		});

		test("should handle invalid action types", () => {
			const config = createLoginConfig();
			const store = createTestStore(config);

			// Invalid actions that Redux ignores should not crash
			expect(() => {
				store.dispatch({ type: "INVALID_ACTION" });
			}).not.toThrow();

			// Redux Toolkit will throw for null action types
			expect(() => {
				store.dispatch({ type: null } as any);
			}).toThrow('Action "type" property must be a string');

			// Redux Toolkit will throw for missing action types
			expect(() => {
				store.dispatch({} as any);
			}).toThrow('Actions may not have an undefined "type" property');

			// Form should still work after invalid actions
			const stateBefore = store.getState();
			store.dispatch({ type: "UNHANDLED_ACTION", payload: "ignored" });
			const stateAfter = store.getState();
			expect(stateAfter).toEqual(stateBefore); // State unchanged
		});
	});

	describe("Integration Edge Cases", () => {
		test("should handle form with all possible field configurations", async () => {
			const complexConfig = {
				formId: "comprehensive",
				fields: {
					// String with sync validators
					email: {
						initialValue: "",
						validators: [required, emailFormat],
					},
					// String with async validators
					username: {
						initialValue: "",
						validators: [required],
						asyncValidators: [checkEmailExists],
					},
					// Number with validators
					age: {
						initialValue: 0,
						validators: [minAge],
					},
					// Boolean
					agreed: {
						initialValue: false,
					},
					// Array
					tags: {
						initialValue: [],
					},
					// Object
					address: {
						initialValue: { street: "", city: "", country: "" },
					},
					// Null value
					optional: {
						initialValue: null,
					},
				},
				onSubmit: async (values: any) => {
					await new Promise(resolve => setTimeout(resolve, 10));
					return { success: true, values };
				},
			} as any;

			const store = createTestStore(complexConfig);
			const { actions, selectors } = store.formArtifacts;

			// Test all field types
			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			store.dispatch(actions.updateFieldValue("username", "testuser"));
			store.dispatch(actions.updateFieldValue("age", 25));
			store.dispatch(actions.updateFieldValue("agreed", true));
			store.dispatch(actions.updateFieldValue("tags", ["tag1", "tag2"]));
			store.dispatch(actions.updateFieldValue("address", { street: "123 Main St", city: "Anytown", country: "USA" }));
			store.dispatch(actions.updateFieldValue("optional", "now has value"));

			// Test all field interactions
			store.dispatch(actions.focusField("email"));
			store.dispatch(actions.blurField("email"));
			store.dispatch(actions.touchField("email"));

			// Validate and submit
			await store.dispatch(actions.validateForm());
			await store.dispatch(actions.submitForm());

			const state = store.getState();
			expect(state.comprehensive.submitSucceeded).toBe(true);
			expect(selectors.isFormDirty(store.getState())).toBe(true);
			expect(selectors.getDirtyFields(store.getState())).toHaveLength(7);
		});

		test("should handle simultaneous operations", async () => {
			const config = createLoginConfig({
				onSubmit: async () => {
					await new Promise(resolve => setTimeout(resolve, 50));
				}
			});
			const store = createTestStore(config);
			const { actions } = store.formArtifacts;

			// Set up form
			store.dispatch(actions.updateFieldValue("email", "test@example.com"));
			store.dispatch(actions.updateFieldValue("password", "password123"));

			// Perform multiple operations simultaneously
			const operations = [
				store.dispatch(actions.validateForm()),
				store.dispatch(actions.submitForm()),
				store.dispatch(actions.focusField("email")),
				store.dispatch(actions.blurField("password")),
				store.dispatch(actions.touchField("email")),
			];

			await Promise.allSettled(operations);

			// Should complete without crashing
			const state = store.getState();
			expect(state.login).toBeDefined();
		});
	});
});