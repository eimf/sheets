"use client";

import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppSelector } from "@/lib/hooks";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    useCreateProductMutation,
    useUpdateProductMutation,
    Product,
    NewProduct,
} from "@/lib/api";
import { useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

const paymentMethods = [
    { value: "card", label: "Card" },
    { value: "cash", label: "Cash" },
    { value: "cashapp", label: "CashApp" },
    { value: "zelle", label: "Zelle" },
    { value: "other", label: "Other" },
];

const paymentDetailSchema = z.object({
    method: z.enum(["card", "cash", "cashapp", "zelle", "other"]),
    amount: z.coerce.number().min(0, "Amount must be positive"),
    label: z.string().optional(),
});

const productSchema = z
    .object({
        name: z.string().min(2, "Name must be at least 2 characters."),
        price: z.coerce.number().min(0, "Price must be a positive number."),
        notes: z
            .string()
            .max(500, "Notes must be under 500 characters.")
            .optional(),
        payments: z
            .array(paymentDetailSchema)
            .nonempty()
            .refine((arr) => {
                const total = arr.reduce((s, p) => s + p.amount, 0);
                return !isNaN(total);
            }, "Invalid payments"),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: "Invalid date",
        }),
    })
    .refine(
        (data) => {
            const total = data.payments.reduce((s, p) => s + p.amount, 0);
            return total === data.price;
        },
        {
            message: "Payment amounts must sum to Price",
            path: ["payments"],
        }
    );

type ProductFormData = z.infer<typeof productSchema>;

export interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    currentCycleId: string;
}

export default function ProductForm({
    isOpen,
    onClose,
    product,
    currentCycleId,
}: ProductFormProps) {
    const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
    const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
    const { user } = useAppSelector((state) => state.auth);
    const isLoading = isCreating || isUpdating;

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
        setValue,
    } = useForm<ProductFormData>({
        resolver: zodResolver(productSchema),
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "payments",
    });

    useEffect(() => {
        if (isOpen) {
            if (product) {
                reset({
                    name: product.name,
                    price: product?.price || 0,
                    notes: product?.notes || "",
                    payments:
                        product.payments && product.payments.length > 0
                            ? product.payments
                            : [{ method: "card", amount: product.price }],
                    date: product.date
                        ? new Date(product.date).toISOString().split("T")[0]
                        : "",
                });
            } else {
                reset({
                    name: "",
                    price: 0,
                    notes: "",
                    payments: [{ method: "card", amount: 0 }],
                    date: new Date().toISOString().split("T")[0],
                });
            }
        }
    }, [product, reset, isOpen]);

    const paymentsWatch = useWatch({ control, name: "payments" });
    useEffect(() => {
        const total = (paymentsWatch || []).reduce(
            (s, p) => s + (parseFloat(String(p.amount)) || 0),
            0
        );
        setValue("price", Number.isFinite(total) ? total : 0, {
            shouldValidate: false,
            shouldDirty: true,
        });
    }, [paymentsWatch, setValue]);

    const onSubmit = async (data: ProductFormData) => {
        try {
            const productDetails: Omit<NewProduct, "cycleId" | "userId"> = {
                ...data,
                date: new Date(data.date).toISOString(),
            };

            if (product) {
                await updateProduct({
                    id: product.id,
                    ...productDetails,
                }).unwrap();
                toast.success("Product updated successfully!");
            } else {
                if (!user?.id) {
                    throw new Error("User ID is required");
                }
                await createProduct({
                    ...productDetails,
                    cycleId: currentCycleId,
                    userId: user.id,
                }).unwrap();
                toast.success("Product added successfully!");
            }
            onClose();
        } catch (err) {
            console.error("Failed to save product:", err);
            toast.error("An error occurred. Please try again.");
        }
    };

    // Handle browser back button: close dialog instead of navigating away
    useEffect(() => {
        if (!isOpen) return;
        const handlePopState = () => {
            onClose();
        };
        // push a dummy state so the first back closes the dialog
        window.history.pushState({ productModalOpen: true }, "");
        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
            // If we are closing the modal programmatically, remove the dummy state
            if (window.history.state && window.history.state.productModalOpen) {
                window.history.back();
            }
        };
    }, [isOpen, onClose]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="sticky top-0 z-20 bg-white border-b flex flex-col gap-2 py-2 px-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <DialogTitle>
                            {product ? "Edit Product" : "Add New Product"}
                        </DialogTitle>
                        <DialogDescription>
                            {product
                                ? "Update the details of the product."
                                : "Add a new product to the current cycle."}
                        </DialogDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto mt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 sm:flex-none"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="productForm"
                            disabled={isLoading}
                            className="flex-1 sm:flex-none"
                        >
                            {isLoading ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogHeader>
                <form
                    id="productForm"
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto px-4"
                >
                    <div>
                        <Label htmlFor="name">Product</Label>
                        <Input
                            id="name"
                            {...register("name")}
                            placeholder="e.g., Shampoo"
                        />
                        {errors.name && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.name.message}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="date">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                {...register("date")}
                            />
                            {errors.date && (
                                <p className="text-red-500 text-sm mt-1">
                                    {errors.date.message}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="price">Price</Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                {...register("price")}
                                disabled
                                className="bg-gray-100 cursor-not-allowed"
                            />
                        </div>
                    </div>
                    {/* Payments Section */}
                    <div>
                        <Label>Payment Methods</Label>
                        {paymentMethods.map((pm) => {
                            const idx = fields.findIndex(
                                (f) => f.method === pm.value
                            );
                            const checked = idx !== -1;
                            return (
                                <div
                                    key={pm.value}
                                    className="flex items-center space-x-2 my-1"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                append({
                                                    method: pm.value as any,
                                                    amount: 0,
                                                    label: "",
                                                });
                                            } else if (idx !== -1) {
                                                remove(idx);
                                            }
                                        }}
                                    />
                                    <span>{pm.label}</span>
                                    {checked && (
                                        <>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="w-24 ml-2"
                                                {...register(
                                                    `payments.${idx}.amount` as const
                                                )}
                                                placeholder="0.00"
                                            />
                                            {pm.value === "other" && (
                                                <Input
                                                    className="ml-2"
                                                    placeholder="Specify method"
                                                    {...register(
                                                        `payments.${idx}.label` as const
                                                    )}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        {errors.payments && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.payments.message as string}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            {...register("notes")}
                            placeholder="Optional notes about the product"
                            rows={3}
                        />
                        {errors.notes && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.notes.message}
                            </p>
                        )}
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
