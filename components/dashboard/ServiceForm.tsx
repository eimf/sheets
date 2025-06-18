"use client";

import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
    useCreateServiceMutation,
    useUpdateServiceMutation,
    Service,
    NewService,
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

const serviceSchema = z
    .object({
        name: z.string().min(2, "Name must be at least 2 characters."),
        customer: z
            .string()
            .min(2, "Customer must be at least 2 characters.")
            .optional(),
        price: z.coerce.number().min(0, "Price must be a positive number."),
        tip: z.coerce
            .number()
            .min(0, "Tip must be a positive number.")
            .optional(),
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

type ServiceFormData = z.infer<typeof serviceSchema>;

export interface ServiceFormProps {
    isOpen: boolean;
    onClose: () => void;
    service: Service | null;
    currentCycleId: string;
}

export default function ServiceForm({
    isOpen,
    onClose,
    service,
    currentCycleId,
}: ServiceFormProps) {
    const [createService, { isLoading: isAdding }] = useCreateServiceMutation();
    const [updateService, { isLoading: isUpdating }] =
        useUpdateServiceMutation();

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
        setValue,
    } = useForm<ServiceFormData>({
        resolver: zodResolver(serviceSchema),
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "payments",
    });

    useEffect(() => {
        if (isOpen) {
            if (service) {
                reset({
                    name: service.name,
                    customer: service.customer || "",
                    price: service?.price || 0,
                    tip: service?.tip || 0,
                    notes: service?.notes || "",
                    payments:
                        service.payments && service.payments.length > 0
                            ? service.payments
                            : [{ method: "card", amount: service.price }],
                    date: service.date
                        ? new Date(service.date).toISOString().split("T")[0]
                        : "",
                });
            } else {
                reset({
                    name: "",
                    customer: "",
                    price: 0,
                    tip: 0,
                    notes: "",
                    payments: [{ method: "card", amount: 0 }],
                    date: new Date().toISOString().split("T")[0],
                });
            }
        }
    }, [service, reset, isOpen]);

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

    const onSubmit = async (data: ServiceFormData) => {
        try {
            const serviceDetails: Omit<NewService, "cycleId" | "userId"> = {
                ...data,
                date: new Date(data.date).toISOString(),
            };

            if (service) {
                await updateService({
                    id: service.id,
                    ...serviceDetails,
                }).unwrap();
                toast.success("Service updated successfully!");
            } else {
                await createService({
                    ...serviceDetails,
                    cycleId: currentCycleId,
                }).unwrap();
                toast.success("Service added successfully!");
            }
            onClose();
        } catch (err) {
            console.error("Failed to save service:", err);
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
        window.history.pushState({ serviceModalOpen: true }, "");
        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
            // If we are closing the modal programmatically, remove the dummy state
            if (window.history.state && window.history.state.serviceModalOpen) {
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
                            {service ? "Edit Service" : "Add New Service"}
                        </DialogTitle>
                        <DialogDescription>
                            {service
                                ? "Update the details of the service."
                                : "Add a new service to the current cycle."}
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
                            form="serviceForm"
                            disabled={isAdding || isUpdating}
                            className="flex-1 sm:flex-none"
                        >
                            {isAdding || isUpdating ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogHeader>
                <form
                    id="serviceForm"
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto px-4"
                >
                    <div>
                        <Label htmlFor="name">Service</Label>
                        <Input
                            id="name"
                            {...register("name")}
                            placeholder="e.g., Haircut"
                        />
                        {errors.name && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.name.message}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="customer">Customer</Label>
                        <Input
                            id="customer"
                            {...register("customer")}
                            placeholder="e.g., John Doe"
                        />
                        {errors.customer && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.customer.message}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="tip">Tip</Label>
                            <Input
                                id="tip"
                                type="number"
                                step="0.01"
                                {...register("tip")}
                                placeholder="e.g., 10.00"
                            />
                            {errors.tip && (
                                <p className="text-red-500 text-sm mt-1">
                                    {errors.tip.message}
                                </p>
                            )}
                        </div>
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
                            placeholder="Optional notes about the service"
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
