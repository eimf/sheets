"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import Header from "@/components/dashboard/Header";
import CycleManager from "@/components/dashboard/CycleManager";
import {
    useGetCycleStatsQuery,
    useGetServicesForUserQuery,
    useGetProductsForUserQuery,
    useGetAdminCyclesQuery,
    type CycleStats,
    type Service,
    type Product,
    type PaymentDetail,
    type Cycle,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { skipToken } from "@reduxjs/toolkit/query";
import ServiceForm from "@/components/dashboard/ServiceForm";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
    const router = useRouter();
    const { isAuthenticated, user, loading } = useAppSelector(
        (state) => state.auth
    );

    // Persist cycle selection in localStorage to survive Fast Refresh
    const [currentCycleId, setCurrentCycleId] = useState<string | null>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("admin_selected_cycle_id");
        }
        return null;
    });

    const [selectedStylist, setSelectedStylist] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(
        null
    );
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);

    // Sorting state for main stats table
    const [statsSortColumn, setStatsSortColumn] = useState<string | null>(null);
    const [statsSortDirection, setStatsSortDirection] = useState<
        "asc" | "desc"
    >("asc");

    // Sorting state for services table
    const [servicesSortColumn, setServicesSortColumn] = useState<string | null>(
        null
    );
    const [servicesSortDirection, setServicesSortDirection] = useState<
        "asc" | "desc"
    >("asc");

    // Sorting state for products table
    const [productsSortColumn, setProductsSortColumn] = useState<string | null>(
        null
    );
    const [productsSortDirection, setProductsSortDirection] = useState<
        "asc" | "desc"
    >("asc");

    // Save cycle selection to localStorage whenever it changes
    useEffect(() => {
        if (currentCycleId) {
            localStorage.setItem("admin_selected_cycle_id", currentCycleId);
        } else {
            localStorage.removeItem("admin_selected_cycle_id");
        }
    }, [currentCycleId]);

    // Fetch services for the selected stylist within the current cycle
    const { data: stylistServices = [], isLoading: isLoadingStylistServices } =
        useGetServicesForUserQuery(
            selectedStylist && currentCycleId
                ? { cycleId: currentCycleId, userId: selectedStylist.id }
                : skipToken
        );

    // Fetch products for the selected stylist within the current cycle
    const { data: stylistProducts = [], isLoading: isLoadingStylistProducts } =
        useGetProductsForUserQuery(
            selectedStylist && currentCycleId
                ? { cycleId: currentCycleId, userId: selectedStylist.id }
                : skipToken
        );

    const { data: cycleStats, isLoading: isLoadingStats } =
        useGetCycleStatsQuery(currentCycleId || "", { skip: !currentCycleId });

    // Fetch all cycles for admin (for cycle selection in edit form)
    const { data: allCycles = [] } = useGetAdminCyclesQuery();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push("/login");
        } else if (!loading && isAuthenticated && user?.role !== "admin") {
            router.push("/dashboard");
        }
    }, [isAuthenticated, loading, router, user]);

    // Sorting helper functions
    const handleStatsSort = (column: string) => {
        if (statsSortColumn === column) {
            setStatsSortDirection(
                statsSortDirection === "asc" ? "desc" : "asc"
            );
        } else {
            setStatsSortColumn(column);
            setStatsSortDirection("asc");
        }
    };

    const handleServicesSort = (column: string) => {
        if (servicesSortColumn === column) {
            setServicesSortDirection(
                servicesSortDirection === "asc" ? "desc" : "asc"
            );
        } else {
            setServicesSortColumn(column);
            setServicesSortDirection("asc");
        }
    };

    const handleProductsSort = (column: string) => {
        if (productsSortColumn === column) {
            setProductsSortDirection(
                productsSortDirection === "asc" ? "desc" : "asc"
            );
        } else {
            setProductsSortColumn(column);
            setProductsSortDirection("asc");
        }
    };

    // Sort stats data
    const sortedStats = cycleStats
        ? [...cycleStats].sort((a, b) => {
              if (!statsSortColumn) return 0;

              let aValue: any;
              let bValue: any;

              switch (statsSortColumn) {
                  case "stylist":
                      aValue = a.stylish?.toLowerCase() || "";
                      bValue = b.stylish?.toLowerCase() || "";
                      break;
                  case "total_services":
                      aValue = a.total_service_price || 0;
                      bValue = b.total_service_price || 0;
                      break;
                  case "total_products":
                      aValue = a.total_product_price || 0;
                      bValue = b.total_product_price || 0;
                      break;
                  case "total_tips":
                      aValue = a.total_tips || 0;
                      bValue = b.total_tips || 0;
                      break;
                  case "service_count":
                      aValue = a.service_count || 0;
                      bValue = b.service_count || 0;
                      break;
                  case "product_count":
                      aValue = a.product_count || 0;
                      bValue = b.product_count || 0;
                      break;
                  default:
                      return 0;
              }

              if (typeof aValue === "string") {
                  return statsSortDirection === "asc"
                      ? aValue.localeCompare(bValue)
                      : bValue.localeCompare(aValue);
              } else {
                  return statsSortDirection === "asc"
                      ? aValue - bValue
                      : bValue - aValue;
              }
          })
        : [];

    // Sort services data
    const sortedServices = stylistServices
        ? [...stylistServices].sort((a, b) => {
              if (!servicesSortColumn) return 0;

              let aValue: any;
              let bValue: any;

              switch (servicesSortColumn) {
                  case "service":
                      aValue = a.name?.toLowerCase() || "";
                      bValue = b.name?.toLowerCase() || "";
                      break;
                  case "customer":
                      aValue = (a.customer || "").toLowerCase();
                      bValue = (b.customer || "").toLowerCase();
                      break;
                  case "price":
                      aValue = a.price || 0;
                      bValue = b.price || 0;
                      break;
                  case "tip":
                      aValue = a.tip || 0;
                      bValue = b.tip || 0;
                      break;
                  case "date":
                      aValue = new Date(a.date).getTime();
                      bValue = new Date(b.date).getTime();
                      break;
                  default:
                      return 0;
              }

              if (typeof aValue === "string") {
                  return servicesSortDirection === "asc"
                      ? aValue.localeCompare(bValue)
                      : bValue.localeCompare(aValue);
              } else {
                  return servicesSortDirection === "asc"
                      ? aValue - bValue
                      : bValue - aValue;
              }
          })
        : [];

    // Sort products data
    const sortedProducts = stylistProducts
        ? [...stylistProducts].sort((a, b) => {
              if (!productsSortColumn) return 0;

              let aValue: any;
              let bValue: any;

              switch (productsSortColumn) {
                  case "product":
                      aValue = a.name?.toLowerCase() || "";
                      bValue = b.name?.toLowerCase() || "";
                      break;
                  case "price":
                      aValue = a.price || 0;
                      bValue = b.price || 0;
                      break;
                  case "date":
                      aValue = new Date(a.date).getTime();
                      bValue = new Date(b.date).getTime();
                      break;
                  default:
                      return 0;
              }

              if (typeof aValue === "string") {
                  return productsSortDirection === "asc"
                      ? aValue.localeCompare(bValue)
                      : bValue.localeCompare(aValue);
              } else {
                  return productsSortDirection === "asc"
                      ? aValue - bValue
                      : bValue - aValue;
              }
          })
        : [];

    if (loading || !isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50">
            <Header />
            <main className="flex-1 px-4 sm:px-6 md:px-8 py-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Admin Dashboard
                    </h1>
                    <div className="bg-white rounded-lg shadow p-6">
                        <CycleManager
                            currentCycleId={currentCycleId}
                            onCycleChange={setCurrentCycleId}
                            showCreateButton={true}
                        />

                        {isLoadingStats && currentCycleId && (
                            <div className="mt-6 space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        )}

                        {!isLoadingStats &&
                            cycleStats &&
                            cycleStats.length > 0 && (
                                <div className="mt-6 overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th
                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                    onClick={() =>
                                                        handleStatsSort(
                                                            "stylist"
                                                        )
                                                    }
                                                >
                                                    <div className="flex items-center space-x-1">
                                                        <span>Stylist</span>
                                                        {statsSortColumn ===
                                                            "stylist" && (
                                                            <span>
                                                                {statsSortDirection ===
                                                                "asc"
                                                                    ? "↑"
                                                                    : "↓"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                    onClick={() =>
                                                        handleStatsSort(
                                                            "total_services"
                                                        )
                                                    }
                                                >
                                                    <div className="flex items-center justify-end space-x-1">
                                                        <span>
                                                            Total of Services
                                                        </span>
                                                        {statsSortColumn ===
                                                            "total_services" && (
                                                            <span>
                                                                {statsSortDirection ===
                                                                "asc"
                                                                    ? "↑"
                                                                    : "↓"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                    onClick={() =>
                                                        handleStatsSort(
                                                            "total_products"
                                                        )
                                                    }
                                                >
                                                    <div className="flex items-center justify-end space-x-1">
                                                        <span>
                                                            Total of Products
                                                        </span>
                                                        {statsSortColumn ===
                                                            "total_products" && (
                                                            <span>
                                                                {statsSortDirection ===
                                                                "asc"
                                                                    ? "↑"
                                                                    : "↓"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                    onClick={() =>
                                                        handleStatsSort(
                                                            "total_tips"
                                                        )
                                                    }
                                                >
                                                    <div className="flex items-center justify-end space-x-1">
                                                        <span>Total Tips</span>
                                                        {statsSortColumn ===
                                                            "total_tips" && (
                                                            <span>
                                                                {statsSortDirection ===
                                                                "asc"
                                                                    ? "↑"
                                                                    : "↓"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                    onClick={() =>
                                                        handleStatsSort(
                                                            "service_count"
                                                        )
                                                    }
                                                >
                                                    <div className="flex items-center justify-end space-x-1">
                                                        <span>
                                                            # of Services
                                                        </span>
                                                        {statsSortColumn ===
                                                            "service_count" && (
                                                            <span>
                                                                {statsSortDirection ===
                                                                "asc"
                                                                    ? "↑"
                                                                    : "↓"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                    onClick={() =>
                                                        handleStatsSort(
                                                            "product_count"
                                                        )
                                                    }
                                                >
                                                    <div className="flex items-center justify-end space-x-1">
                                                        <span>
                                                            # of Products
                                                        </span>
                                                        {statsSortColumn ===
                                                            "product_count" && (
                                                            <span>
                                                                {statsSortDirection ===
                                                                "asc"
                                                                    ? "↑"
                                                                    : "↓"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {sortedStats
                                                .filter(
                                                    (stat: CycleStats) =>
                                                        stat.service_count >
                                                            0 ||
                                                        stat.product_count > 0
                                                )
                                                .map((stat: CycleStats) => (
                                                    <tr
                                                        key={stat.user_id}
                                                        className="cursor-pointer hover:bg-gray-100"
                                                        onClick={() =>
                                                            setSelectedStylist({
                                                                id: String(
                                                                    stat.user_id
                                                                ),
                                                                name: stat.stylish,
                                                            })
                                                        }
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {stat.stylish}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            $
                                                            {(
                                                                stat.total_service_price ||
                                                                0
                                                            ).toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            $
                                                            {(
                                                                stat.total_product_price ||
                                                                0
                                                            ).toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            $
                                                            {stat.total_tips.toFixed(
                                                                2
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            {stat.service_count}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            {stat.product_count ||
                                                                0}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                        {/* Services for selected stylist */}
                        {selectedStylist && (
                            <div className="mt-10">
                                <h2 className="text-xl font-semibold mb-4">
                                    Services for {selectedStylist.name}
                                </h2>
                                {isLoadingStylistServices && (
                                    <p>Loading services...</p>
                                )}
                                {!isLoadingStylistServices &&
                                    stylistServices &&
                                    stylistServices.length > 0 && (
                                        <div className="overflow-x-auto bg-white shadow rounded-lg">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th
                                                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleServicesSort(
                                                                    "service"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center space-x-1">
                                                                <span>
                                                                    Service
                                                                </span>
                                                                {servicesSortColumn ===
                                                                    "service" && (
                                                                    <span>
                                                                        {servicesSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th
                                                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleServicesSort(
                                                                    "customer"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center space-x-1">
                                                                <span>
                                                                    Customer
                                                                </span>
                                                                {servicesSortColumn ===
                                                                    "customer" && (
                                                                    <span>
                                                                        {servicesSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th
                                                            className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleServicesSort(
                                                                    "price"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center justify-end space-x-1">
                                                                <span>
                                                                    Price
                                                                </span>
                                                                {servicesSortColumn ===
                                                                    "price" && (
                                                                    <span>
                                                                        {servicesSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th
                                                            className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleServicesSort(
                                                                    "tip"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center justify-end space-x-1">
                                                                <span>Tip</span>
                                                                {servicesSortColumn ===
                                                                    "tip" && (
                                                                    <span>
                                                                        {servicesSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th
                                                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleServicesSort(
                                                                    "date"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center space-x-1">
                                                                <span>
                                                                    Date
                                                                </span>
                                                                {servicesSortColumn ===
                                                                    "date" && (
                                                                    <span>
                                                                        {servicesSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {sortedServices.map(
                                                        (svc: Service) => (
                                                            <Fragment
                                                                key={svc.id}
                                                            >
                                                                <tr className="hover:bg-gray-50">
                                                                    <td
                                                                        className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                                                                        onClick={() =>
                                                                            setExpandedServiceId(
                                                                                (
                                                                                    prev
                                                                                ) =>
                                                                                    prev ===
                                                                                    svc.id
                                                                                        ? null
                                                                                        : svc.id
                                                                            )
                                                                        }
                                                                    >
                                                                        {
                                                                            svc.name
                                                                        }
                                                                    </td>
                                                                    <td
                                                                        className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                                                                        onClick={() =>
                                                                            setExpandedServiceId(
                                                                                (
                                                                                    prev
                                                                                ) =>
                                                                                    prev ===
                                                                                    svc.id
                                                                                        ? null
                                                                                        : svc.id
                                                                            )
                                                                        }
                                                                    >
                                                                        {svc.customer ||
                                                                            "-"}
                                                                    </td>
                                                                    <td
                                                                        className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right cursor-pointer"
                                                                        onClick={() =>
                                                                            setExpandedServiceId(
                                                                                (
                                                                                    prev
                                                                                ) =>
                                                                                    prev ===
                                                                                    svc.id
                                                                                        ? null
                                                                                        : svc.id
                                                                            )
                                                                        }
                                                                    >
                                                                        $
                                                                        {svc.price.toFixed(
                                                                            2
                                                                        )}
                                                                    </td>
                                                                    <td
                                                                        className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right cursor-pointer"
                                                                        onClick={() =>
                                                                            setExpandedServiceId(
                                                                                (
                                                                                    prev
                                                                                ) =>
                                                                                    prev ===
                                                                                    svc.id
                                                                                        ? null
                                                                                        : svc.id
                                                                            )
                                                                        }
                                                                    >
                                                                        $
                                                                        {(
                                                                            svc.tip ||
                                                                            0
                                                                        ).toFixed(
                                                                            2
                                                                        )}
                                                                    </td>
                                                                    <td
                                                                        className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                                                                        onClick={() =>
                                                                            setExpandedServiceId(
                                                                                (
                                                                                    prev
                                                                                ) =>
                                                                                    prev ===
                                                                                    svc.id
                                                                                        ? null
                                                                                        : svc.id
                                                                            )
                                                                        }
                                                                    >
                                                                        {new Date(
                                                                            svc.date
                                                                        ).toLocaleDateString()}
                                                                    </td>
                                                                    <td
                                                                        className="px-4 py-2 whitespace-nowrap text-sm"
                                                                        onClick={(
                                                                            e
                                                                        ) =>
                                                                            e.stopPropagation()
                                                                        }
                                                                    >
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setEditingService(
                                                                                    svc
                                                                                );
                                                                                setIsServiceFormOpen(
                                                                                    true
                                                                                );
                                                                            }}
                                                                        >
                                                                            Edit
                                                                        </Button>
                                                                    </td>
                                                                </tr>

                                                                {expandedServiceId ===
                                                                    svc.id && (
                                                                    <tr className="bg-gray-50">
                                                                        <td
                                                                            colSpan={
                                                                                6
                                                                            }
                                                                            className="px-4 py-4 text-sm text-gray-700"
                                                                        >
                                                                            <div className="space-y-2">
                                                                                <div>
                                                                                    <span className="font-medium">
                                                                                        Notes:
                                                                                    </span>{" "}
                                                                                    {svc.notes ||
                                                                                        "—"}
                                                                                </div>
                                                                                <div>
                                                                                    <span className="font-medium">
                                                                                        Payments:
                                                                                    </span>
                                                                                    {svc.payments &&
                                                                                    svc
                                                                                        .payments
                                                                                        .length >
                                                                                        0 ? (
                                                                                        <ul className="list-disc list-inside ml-4 mt-1">
                                                                                            {svc.payments.map(
                                                                                                (
                                                                                                    p: PaymentDetail,
                                                                                                    idx: number
                                                                                                ) => (
                                                                                                    <li
                                                                                                        key={
                                                                                                            idx
                                                                                                        }
                                                                                                    >
                                                                                                        {
                                                                                                            p.method
                                                                                                        }

                                                                                                        :
                                                                                                        $
                                                                                                        {p.amount.toFixed(
                                                                                                            2
                                                                                                        )}{" "}
                                                                                                        {p.label
                                                                                                            ? `(${p.label})`
                                                                                                            : ""}
                                                                                                    </li>
                                                                                                )
                                                                                            )}
                                                                                        </ul>
                                                                                    ) : (
                                                                                        <span>
                                                                                            {" "}
                                                                                            —
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </Fragment>
                                                        )
                                                    )}
                                                    {/* Payment method breakdown for services */}
                                                    {stylistServices.length >
                                                        0 && (
                                                        <tr className="bg-gray-100">
                                                            <td
                                                                colSpan={5}
                                                                className="px-4 py-4 text-sm"
                                                            >
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-700 mb-2">
                                                                        Payment
                                                                        Method
                                                                        Breakdown:
                                                                    </h4>
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                                                                        {(() => {
                                                                            // Calculate totals by payment method
                                                                            const methodTotals =
                                                                                stylistServices.reduce(
                                                                                    (
                                                                                        totals,
                                                                                        svc
                                                                                    ) => {
                                                                                        if (
                                                                                            svc.payments &&
                                                                                            svc
                                                                                                .payments
                                                                                                .length >
                                                                                                0
                                                                                        ) {
                                                                                            svc.payments.forEach(
                                                                                                (
                                                                                                    p
                                                                                                ) => {
                                                                                                    if (
                                                                                                        !totals[
                                                                                                            p
                                                                                                                .method
                                                                                                        ]
                                                                                                    ) {
                                                                                                        totals[
                                                                                                            p.method
                                                                                                        ] = 0;
                                                                                                    }
                                                                                                    totals[
                                                                                                        p.method
                                                                                                    ] +=
                                                                                                        p.amount;
                                                                                                }
                                                                                            );
                                                                                        }
                                                                                        return totals;
                                                                                    },
                                                                                    {} as Record<
                                                                                        string,
                                                                                        number
                                                                                    >
                                                                                );

                                                                            // Display each payment method total
                                                                            return Object.entries(
                                                                                methodTotals
                                                                            ).map(
                                                                                ([
                                                                                    method,
                                                                                    total,
                                                                                ]) => (
                                                                                    <div
                                                                                        key={
                                                                                            method
                                                                                        }
                                                                                        className="flex items-center space-x-2"
                                                                                    >
                                                                                        <span className="font-medium capitalize">
                                                                                            {
                                                                                                method
                                                                                            }

                                                                                            :
                                                                                        </span>
                                                                                        <span>
                                                                                            $
                                                                                            {total.toFixed(
                                                                                                2
                                                                                            )}
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                {!isLoadingStylistServices &&
                                    stylistServices &&
                                    stylistServices.length === 0 && (
                                        <p className="text-gray-500">
                                            No services found for this stylist
                                            in this cycle.
                                        </p>
                                    )}

                                {/* Products for selected stylist */}
                                <h2 className="text-xl font-semibold mb-4 mt-8">
                                    Products for {selectedStylist.name}
                                </h2>
                                {isLoadingStylistProducts && (
                                    <p>Loading products...</p>
                                )}
                                {!isLoadingStylistProducts &&
                                    stylistProducts &&
                                    stylistProducts.length > 0 && (
                                        <div className="overflow-x-auto bg-white shadow rounded-lg">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th
                                                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleProductsSort(
                                                                    "product"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center space-x-1">
                                                                <span>
                                                                    Product
                                                                </span>
                                                                {productsSortColumn ===
                                                                    "product" && (
                                                                    <span>
                                                                        {productsSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th
                                                            className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleProductsSort(
                                                                    "price"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center justify-end space-x-1">
                                                                <span>
                                                                    Price
                                                                </span>
                                                                {productsSortColumn ===
                                                                    "price" && (
                                                                    <span>
                                                                        {productsSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th
                                                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                                            onClick={() =>
                                                                handleProductsSort(
                                                                    "date"
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center space-x-1">
                                                                <span>
                                                                    Date
                                                                </span>
                                                                {productsSortColumn ===
                                                                    "date" && (
                                                                    <span>
                                                                        {productsSortDirection ===
                                                                        "asc"
                                                                            ? "↑"
                                                                            : "↓"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {sortedProducts.map(
                                                        (product: Product) => (
                                                            <Fragment
                                                                key={product.id}
                                                            >
                                                                <tr
                                                                    className="cursor-pointer hover:bg-gray-50"
                                                                    onClick={() =>
                                                                        setExpandedServiceId(
                                                                            (
                                                                                prev
                                                                            ) =>
                                                                                prev ===
                                                                                product.id
                                                                                    ? null
                                                                                    : product.id
                                                                        )
                                                                    }
                                                                >
                                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                                        {
                                                                            product.name
                                                                        }
                                                                    </td>
                                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                                                                        $
                                                                        {product.price.toFixed(
                                                                            2
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                        {new Date(
                                                                            product.date
                                                                        ).toLocaleDateString()}
                                                                    </td>
                                                                </tr>

                                                                {expandedServiceId ===
                                                                    product.id && (
                                                                    <tr className="bg-gray-50">
                                                                        <td
                                                                            colSpan={
                                                                                3
                                                                            }
                                                                            className="px-4 py-4 text-sm text-gray-700"
                                                                        >
                                                                            <div className="space-y-2">
                                                                                <div>
                                                                                    <span className="font-medium">
                                                                                        Notes:
                                                                                    </span>{" "}
                                                                                    {product.notes ||
                                                                                        "—"}
                                                                                </div>
                                                                                <div>
                                                                                    <span className="font-medium">
                                                                                        Payments:
                                                                                    </span>
                                                                                    {product.payments &&
                                                                                    product
                                                                                        .payments
                                                                                        .length >
                                                                                        0 ? (
                                                                                        <ul className="list-disc list-inside ml-4 mt-1">
                                                                                            {product.payments.map(
                                                                                                (
                                                                                                    p: PaymentDetail,
                                                                                                    idx: number
                                                                                                ) => (
                                                                                                    <li
                                                                                                        key={
                                                                                                            idx
                                                                                                        }
                                                                                                    >
                                                                                                        {
                                                                                                            p.method
                                                                                                        }

                                                                                                        :
                                                                                                        $
                                                                                                        {p.amount.toFixed(
                                                                                                            2
                                                                                                        )}{" "}
                                                                                                        {p.label
                                                                                                            ? `(${p.label})`
                                                                                                            : ""}
                                                                                                    </li>
                                                                                                )
                                                                                            )}
                                                                                        </ul>
                                                                                    ) : (
                                                                                        <span>
                                                                                            {" "}
                                                                                            —
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </Fragment>
                                                        )
                                                    )}
                                                    {/* Payment method breakdown for products */}
                                                    {stylistProducts.length >
                                                        0 && (
                                                        <tr className="bg-gray-100">
                                                            <td
                                                                colSpan={3}
                                                                className="px-4 py-4 text-sm"
                                                            >
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-700 mb-2">
                                                                        Payment
                                                                        Method
                                                                        Breakdown:
                                                                    </h4>
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                                                                        {(() => {
                                                                            // Calculate totals by payment method
                                                                            const methodTotals =
                                                                                stylistProducts.reduce(
                                                                                    (
                                                                                        totals,
                                                                                        product
                                                                                    ) => {
                                                                                        if (
                                                                                            product.payments &&
                                                                                            product
                                                                                                .payments
                                                                                                .length >
                                                                                                0
                                                                                        ) {
                                                                                            product.payments.forEach(
                                                                                                (
                                                                                                    p
                                                                                                ) => {
                                                                                                    if (
                                                                                                        !totals[
                                                                                                            p
                                                                                                                .method
                                                                                                        ]
                                                                                                    ) {
                                                                                                        totals[
                                                                                                            p.method
                                                                                                        ] = 0;
                                                                                                    }
                                                                                                    totals[
                                                                                                        p.method
                                                                                                    ] +=
                                                                                                        p.amount;
                                                                                                }
                                                                                            );
                                                                                        }
                                                                                        return totals;
                                                                                    },
                                                                                    {} as Record<
                                                                                        string,
                                                                                        number
                                                                                    >
                                                                                );

                                                                            // Display each payment method total
                                                                            return Object.entries(
                                                                                methodTotals
                                                                            ).map(
                                                                                ([
                                                                                    method,
                                                                                    total,
                                                                                ]) => (
                                                                                    <div
                                                                                        key={
                                                                                            method
                                                                                        }
                                                                                        className="flex items-center space-x-2"
                                                                                    >
                                                                                        <span className="font-medium capitalize">
                                                                                            {
                                                                                                method
                                                                                            }

                                                                                            :
                                                                                        </span>
                                                                                        <span>
                                                                                            $
                                                                                            {total.toFixed(
                                                                                                2
                                                                                            )}
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                {!isLoadingStylistProducts &&
                                    stylistProducts &&
                                    stylistProducts.length === 0 && (
                                        <p className="text-gray-500">
                                            No products found for this stylist
                                            in this cycle.
                                        </p>
                                    )}
                            </div>
                        )}

                        {!isLoadingStats &&
                            cycleStats &&
                            cycleStats.length === 0 && (
                                <div className="mt-6 text-center text-gray-500">
                                    No services found for this cycle.
                                </div>
                            )}
                    </div>
                </div>
            </main>
            <ServiceForm
                isOpen={isServiceFormOpen}
                onClose={() => {
                    setIsServiceFormOpen(false);
                    setEditingService(null);
                }}
                service={editingService}
                currentCycleId={currentCycleId || ""}
                allowCycleSelection={true}
                availableCycles={allCycles}
            />
        </div>
    );
}
