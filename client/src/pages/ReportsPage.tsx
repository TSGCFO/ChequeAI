import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Loader2, Database, Table as TableIcon, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '../lib/queryClient';

interface SchemaItem {
  table_name: string;
  table_type: string;
  table_schema: string;
}

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableData {
  columns: Column[];
  data: any[];
  totalCount: number;
  limit: number;
  offset: number;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('tables');

  // Get all tables and views in the database
  const {
    data: schemaItems,
    isLoading: schemaLoading,
    error: schemaError,
  } = useQuery({
    queryKey: ['/api/report/schema'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/report/schema');
      const data = await res.json();
      return data as SchemaItem[];
    },
  });

  // Get data for the selected table
  const {
    data: tableData,
    isLoading: tableLoading,
    error: tableError,
    refetch: refetchTableData,
  } = useQuery({
    queryKey: ['/api/report/data', selectedTable, page, limit],
    queryFn: async () => {
      if (!selectedTable) return null;
      const res = await apiRequest('GET', `/api/report/data/${selectedTable}?limit=${limit}&offset=${(page - 1) * limit}`);
      const data = await res.json();
      return data as TableData;
    },
    enabled: !!selectedTable, // Only fetch if a table is selected
  });

  // Filter schema items based on search term and tab
  const filteredSchemaItems = schemaItems?.filter((item) => {
    const matchesSearch = searchTerm === '' || 
      item.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.table_schema.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = 
      (tab === 'tables' && item.table_type === 'BASE TABLE') ||
      (tab === 'views' && item.table_type === 'VIEW') ||
      (tab === 'all');
    
    return matchesSearch && matchesTab;
  });

  // Handle table selection
  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Show error toast if there are errors
  useEffect(() => {
    if (schemaError) {
      toast({
        title: 'Error loading schema',
        description: 'Failed to load database schema information.',
        variant: 'destructive',
      });
    }

    if (tableError) {
      toast({
        title: 'Error loading table data',
        description: `Failed to load data for ${selectedTable}.`,
        variant: 'destructive',
      });
    }
  }, [schemaError, tableError, selectedTable, toast]);

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Database Reports</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Schema sidebar */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Schema
            </CardTitle>
            <CardDescription>
              Select a table or view to explore its data
            </CardDescription>
            <div className="mt-2">
              <Input
                placeholder="Search tables and views..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tables" value={tab} onValueChange={setTab}>
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="tables" className="flex-1">Tables</TabsTrigger>
                <TabsTrigger value="views" className="flex-1">Views</TabsTrigger>
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              </TabsList>

              {schemaLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredSchemaItems?.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No {tab === 'all' ? 'tables or views' : tab} found matching "{searchTerm}"
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredSchemaItems?.map((item) => (
                        <Button
                          key={`${item.table_schema}.${item.table_name}`}
                          variant={selectedTable === `${item.table_schema}.${item.table_name}` ? 'default' : 'ghost'}
                          className="w-full justify-start text-left"
                          onClick={() => handleTableSelect(`${item.table_schema}.${item.table_name}`)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {item.table_type === 'BASE TABLE' ? <TableIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            <span className="truncate flex-1">{item.table_name}</span>
                            <Badge variant="outline" className="ml-auto text-xs">
                              {item.table_schema}
                            </Badge>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* Table data view */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>
              {selectedTable ? (
                <div className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5" />
                  {selectedTable.split('.')[1]}
                </div>
              ) : (
                'Table Data'
              )}
            </CardTitle>
            {selectedTable && (
              <CardDescription>
                Viewing data from {selectedTable}
              </CardDescription>
            )}
            {tableData && (
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="limit">Rows per page:</Label>
                  <Select
                    value={limit.toString()}
                    onValueChange={(value) => {
                      setLimit(parseInt(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger id="limit" className="w-[100px]">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {tableData.totalCount} total records
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedTable ? (
              <div className="text-center py-10 text-muted-foreground">
                Select a table or view from the sidebar to view its data
              </div>
            ) : tableLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : tableData ? (
              <>
                <div className="rounded-md border overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {tableData.columns.map((column) => (
                            <TableHead key={column.column_name}>
                              {column.column_name}
                              <div className="text-xs text-muted-foreground font-normal">
                                {column.data_type} {column.is_nullable === 'YES' ? '(nullable)' : ''}
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.data.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={tableData.columns.length}
                              className="h-24 text-center"
                            >
                              No records found
                            </TableCell>
                          </TableRow>
                        ) : (
                          tableData.data.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {tableData.columns.map((column) => (
                                <TableCell key={`${rowIndex}-${column.column_name}`}>
                                  {formatCellValue(row[column.column_name])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pagination */}
                {tableData.totalCount > limit && (
                  <Pagination className="mt-4">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => page > 1 && handlePageChange(page - 1)}
                          className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      
                      {generatePaginationItems(page, Math.ceil(tableData.totalCount / limit)).map((item, i) => (
                        item === '...' ? (
                          <PaginationItem key={`ellipsis-${i}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={`page-${item}`}>
                            <PaginationLink
                              isActive={page === item}
                              onClick={() => handlePageChange(item as number)}
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => page < Math.ceil(tableData.totalCount / limit) && handlePageChange(page + 1)}
                          className={page >= Math.ceil(tableData.totalCount / limit) ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                Failed to load data for {selectedTable}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper function to format cell values for display
function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return '<null>';
  }
  
  if (typeof value === 'object') {
    // Check if it's a date
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      return new Date(value).toLocaleString();
    }
    
    // Otherwise stringify the object
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  
  return String(value);
}

// Helper function to generate pagination items
function generatePaginationItems(currentPage: number, totalPages: number): (number | string)[] {
  const items: (number | string)[] = [];
  
  if (totalPages <= 7) {
    // If we have 7 or fewer pages, show all page numbers
    for (let i = 1; i <= totalPages; i++) {
      items.push(i);
    }
  } else {
    // Always include the first page
    items.push(1);
    
    // Add ellipsis or page numbers around the current page
    if (currentPage > 3) {
      items.push('...');
    }
    
    // Calculate the starting and ending pages to show around the current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    // Add the page numbers around the current page
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    
    // Add ellipsis if needed
    if (currentPage < totalPages - 2) {
      items.push('...');
    }
    
    // Always include the last page
    items.push(totalPages);
  }
  
  return items;
}